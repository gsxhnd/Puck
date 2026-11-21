/**
 * IPC wrappers for the local Git backend.
 *
 * 本地 Git 后端的 IPC 封装。所有 git 相关命令统一收口在本文件，组件不直接
 * invoke。状态与解析结构与 `src/types/workspace.ts` 中的类型一一对应。
 */
import { invoke } from "@tauri-apps/api/core";
import { isRecord } from "@/lib/ipc-parse";
import type {
  GitBranchEntry,
  GitCommitEntry,
  GitNetworkErrorKind,
  GitNetworkResult,
  GitStatusResult,
  GitGraphCommit,
} from "@/types/workspace";

function gitCommand(local: string, remote: string, connectionId?: string): string {
  return connectionId ? remote : local;
}

const NETWORK_ERROR_KINDS = new Set([
  "auth",
  "no_upstream",
  "network",
]) as ReadonlySet<GitNetworkErrorKind>;

function parseGitNetworkResult(value: unknown): GitNetworkResult {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new Error("Invalid git network response");
  }
  return {
    ok: value.ok,
    errorKind:
      typeof value.errorKind === "string" &&
      NETWORK_ERROR_KINDS.has(value.errorKind as GitNetworkErrorKind)
        ? (value.errorKind as GitNetworkErrorKind)
        : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
  };
}

/** Fetches all remotes with pruning. / 拉取全部远端并清理已删除引用。 */
export function gitFetch(path: string, connectionId?: string): Promise<GitNetworkResult> {
  return invoke<unknown>(gitCommand("git_fetch", "remote_git_fetch", connectionId), {
    path,
    connectionId,
  }).then(parseGitNetworkResult);
}

/** Fast-forward only pull. / 仅快进的拉取。 */
export function gitPull(path: string, connectionId?: string): Promise<GitNetworkResult> {
  return invoke<unknown>(gitCommand("git_pull", "remote_git_pull", connectionId), {
    path,
    connectionId,
  }).then(parseGitNetworkResult);
}

/** Pushes the current branch (auto-publishes without upstream). / 推送当前分支（无 upstream 时自动发布）。 */
export function gitPush(path: string, connectionId?: string): Promise<GitNetworkResult> {
  return invoke<unknown>(gitCommand("git_push", "remote_git_push", connectionId), {
    path,
    connectionId,
  }).then(parseGitNetworkResult);
}

function parseGitFileStatus(value: unknown) {
  if (!isRecord(value)) return null;
  if (
    typeof value.path !== "string" ||
    typeof value.indexStatus !== "string" ||
    typeof value.worktreeStatus !== "string"
  ) {
    return null;
  }
  return {
    path: value.path,
    indexStatus: value.indexStatus,
    worktreeStatus: value.worktreeStatus,
    origPath: typeof value.origPath === "string" ? value.origPath : undefined,
  };
}

function parseGitStatusResult(value: unknown): GitStatusResult {
  if (!isRecord(value) || typeof value.isRepo !== "boolean") {
    throw new Error("Invalid git status response");
  }

  const staged = Array.isArray(value.staged)
    ? value.staged
        .map(parseGitFileStatus)
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const unstaged = Array.isArray(value.unstaged)
    ? value.unstaged
        .map(parseGitFileStatus)
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const untracked = Array.isArray(value.untracked)
    ? value.untracked.filter((item): item is string => typeof item === "string")
    : [];

  return {
    isRepo: value.isRepo,
    branch: typeof value.branch === "string" ? value.branch : undefined,
    upstream: typeof value.upstream === "string" ? value.upstream : undefined,
    ahead: typeof value.ahead === "number" ? value.ahead : undefined,
    behind: typeof value.behind === "number" ? value.behind : undefined,
    staged,
    unstaged,
    untracked,
  };
}

/** Reads the aggregate status of a local git workspace. / 读取本地 git 工作区的聚合状态。 */
export async function gitStatus(path: string, connectionId?: string): Promise<GitStatusResult> {
  const result = await invoke<unknown>(
    gitCommand("git_status", "remote_git_status", connectionId),
    { path, connectionId },
  );
  return parseGitStatusResult(result);
}

/**
 * Reads a file blob from the index or HEAD; null when absent in that
 * revision.
 * 读取文件在 index 或 HEAD 中的 blob 内容；该版本不存在时返回 null。
 */
export async function gitBlobContent(
  path: string,
  file: string,
  revision: "index" | "head",
  connectionId?: string,
): Promise<string | null> {
  const result = await invoke<unknown>(
    gitCommand("git_blob_content", "remote_git_blob_content", connectionId),
    { path, file, revision, connectionId },
  );
  return typeof result === "string" ? result : null;
}

/** Stages the given workspace-relative files. / 暂存指定的工作区相对路径文件。 */
export function gitStage(path: string, files: string[], connectionId?: string): Promise<void> {
  return invoke(gitCommand("git_stage", "remote_git_stage", connectionId), {
    path,
    files,
    connectionId,
  });
}

/** Unstages the given files. / 取消暂存指定文件。 */
export function gitUnstage(path: string, files: string[], connectionId?: string): Promise<void> {
  return invoke(gitCommand("git_unstage", "remote_git_unstage", connectionId), {
    path,
    files,
    connectionId,
  });
}

/**
 * Discards unstaged worktree modifications for tracked files.
 * 放弃已跟踪文件未暂存的工作区修改（调用方必须先与用户确认）。
 */
export function gitDiscard(path: string, files: string[], connectionId?: string): Promise<void> {
  return invoke(gitCommand("git_discard", "remote_git_discard", connectionId), {
    path,
    files,
    connectionId,
  });
}

/** Commits the staged changes with the given message. / 以给定信息提交已暂存变更。 */
export function gitCommit(path: string, message: string, connectionId?: string): Promise<void> {
  return invoke(gitCommand("git_commit", "remote_git_commit", connectionId), {
    path,
    message,
    connectionId,
  });
}

/** Reads a simplified local commit history. / 读取本地仓库的简洁提交历史。 */
export async function gitLog(
  path: string,
  limit = 20,
  connectionId?: string,
): Promise<GitCommitEntry[]> {
  const result = await invoke<unknown>(
    gitCommand("git_log", "remote_git_log", connectionId),
    { path, limit, connectionId },
  );
  if (!Array.isArray(result)) {
    throw new Error("Invalid git log response");
  }
  return result.filter((entry): entry is GitCommitEntry => {
    if (!isRecord(entry)) return false;
    return (
      typeof entry.hash === "string" &&
      typeof entry.shortHash === "string" &&
      typeof entry.author === "string" &&
      typeof entry.date === "string" &&
      typeof entry.subject === "string"
    );
  });
}

/** Reads one page of DAG commits for the graph view. / 分页读取提交图 DAG 数据。 */
export async function gitGraph(
  path: string,
  limit = 200,
  skip = 0,
  connectionId?: string,
): Promise<GitGraphCommit[]> {
  const result = await invoke<unknown>(
    gitCommand("git_graph", "remote_git_graph", connectionId),
    { path, limit, skip, connectionId },
  );
  if (!Array.isArray(result)) throw new Error("Invalid git graph response");
  return result.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    if (
      typeof entry.hash !== "string" ||
      typeof entry.shortHash !== "string" ||
      typeof entry.author !== "string" ||
      typeof entry.date !== "string" ||
      typeof entry.subject !== "string" ||
      !Array.isArray(entry.parents) ||
      !Array.isArray(entry.refs)
    ) {
      return [];
    }
    return [{
      hash: entry.hash,
      shortHash: entry.shortHash,
      author: entry.author,
      date: entry.date,
      subject: entry.subject,
      parents: entry.parents.filter((value): value is string => typeof value === "string"),
      refs: entry.refs.filter((value): value is string => typeof value === "string"),
    }];
  });
}

/** Lists local branches with the current one marked. / 列出本地分支并标记当前检出分支。 */
export async function gitBranches(path: string, connectionId?: string): Promise<GitBranchEntry[]> {
  const result = await invoke<unknown>(
    gitCommand("git_branches", "remote_git_branches", connectionId),
    { path, connectionId },
  );
  if (!Array.isArray(result)) {
    throw new Error("Invalid git branches response");
  }
  return result.filter((entry): entry is GitBranchEntry => {
    if (!isRecord(entry)) return false;
    return (
      typeof entry.name === "string" &&
      typeof entry.shortHash === "string" &&
      typeof entry.isCurrent === "boolean"
    );
  });
}

/** Checks out a branch; git refuses when the worktree conflicts. / 切换分支；工作区冲突时 git 拒绝并透出错误。 */
export function gitCheckout(path: string, branch: string, connectionId?: string): Promise<void> {
  return invoke(gitCommand("git_checkout", "remote_git_checkout", connectionId), {
    path,
    branch,
    connectionId,
  });
}

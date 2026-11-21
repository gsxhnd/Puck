/**
 * Git panel for the second sidebar panel.
 *
 * 右侧详情面板的 Git 视图：分支与 ahead/behind、staged/unstaged/untracked
 * 三个分组列表。staged/unstaged 文件可点击打开工作台 Diff 标签（staged 为
 * HEAD↔index，unstaged 为 index↔工作区），并提供 stage/unstage/discard 与
 * commit 操作；discard 属于不可逆操作，必须经过用户确认。
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownIcon,
  ArrowDownToLineIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  GitBranchIcon,
  GitForkIcon,
  RefreshCwIcon,
  Undo2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceWatch } from "@/hooks/use-workspace-watch";
import {
  gitBranches,
  gitBlobContent,
  gitCheckout,
  gitCommit,
  gitDiscard,
  gitFetch,
  gitLog,
  gitPull,
  gitPush,
  gitStage,
  gitStatus,
  gitUnstage,
} from "@/lib/tauri-git";
import { writeTerminal } from "@/lib/tauri-terminal";
import { readLocalFile } from "@/lib/tauri-workspace";
import { readRemoteFile } from "@/lib/tauri-sftp";
import {
  ensureSftpExplorerSession,
  explorerSftpSessionId,
} from "@/lib/sftp-explorer-session";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { fileNameFromPath, guessMonacoLanguage } from "@/lib/editor-params";
import { useActiveLocalSession } from "@/lib/use-active-local-session";
import { parsePuckError } from "@/lib/puck-error";
import { setDiffContent } from "@/editor/diff-content";
import { useWorkbenchStore } from "@/stores/workbench-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type {
  GitBranchEntry,
  GitCommitEntry,
  GitFileStatus,
  GitStatusResult,
} from "@/types/workspace";
import { useWorkspaceStore, type Workspace } from "@/stores/workspace-store";
import type { GitNetworkErrorKind } from "@/types/workspace";

function statusLabel(status: string): string {
  const trimmed = status.trim();
  return trimmed || "·";
}

/** Joins a workspace path with a git-reported relative path. / 把工作区路径与 git 返回的相对路径拼接为本地可读路径。 */
function joinWorkspacePath(workspacePath: string, file: string): string {
  if (workspacePath === "~") return `~/${file}`;
  return `${workspacePath.replace(/\/+$/, "")}/${file}`;
}

function GitFileRow({
  file,
  clickable,
  actions,
  onOpenDiff,
}: {
  file: GitFileStatus;
  clickable: boolean;
  actions: React.ReactNode;
  onOpenDiff: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-background/60"
    >
      <span className="w-4 shrink-0 font-mono text-muted-foreground">
        {statusLabel(file.indexStatus)}
        {statusLabel(file.worktreeStatus)}
      </span>
      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 truncate text-left font-mono",
          clickable && "cursor-pointer hover:underline",
        )}
        title={file.path}
        disabled={!clickable}
        onClick={() => {
          if (clickable) onOpenDiff();
        }}
      >
        {file.path}
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-60 group-hover:opacity-100">
        {actions}
      </div>
    </div>
  );
}

function GitSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="space-y-0.5">
      <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">
        {title} ({count})
      </h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

export function GitPanel({ workspace }: { workspace?: Workspace } = {}) {
  const { t } = useTranslation("info");
  const localContext = useActiveLocalSession();
  const activeSession = workspace
    ? {
        id: `workspace:${workspace.id}`,
        kind: "terminal" as const,
        title: workspace.name,
        protocol: workspace.source === "remote" ? ("ssh" as const) : ("local" as const),
        profileId: workspace.profileId,
        cwd: workspace.rootPath,
        workspaceId: workspace.id,
        status: "connected" as const,
        createdAt: "",
      }
    : localContext.activeSession;
  const isLocal = workspace ? workspace.source === "local" : localContext.isLocal;
  const workspacePath = workspace?.rootPath ?? localContext.workspacePath;
  const connectionId = workspace?.source === "remote" ? workspace.profileId : undefined;
  const remoteStatus = useWorkspaceStore((state) => state.remoteStatus);
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [history, setHistory] = useState<GitCommitEntry[]>([]);
  const [branches, setBranches] = useState<GitBranchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = await gitStatus(workspacePath, connectionId);
        setStatus(result);
        // History and branch list failures degrade silently (e.g. a repo with
        // no commits yet); the status area already reports real problems.
        // 历史与分支列表失败时静默降级（例如尚无提交的空仓库）；真正的
        // 状态错误已由 error 区域展示。
        const [logResult, branchResult] = await Promise.all([
          gitLog(workspacePath, 20, connectionId).catch(() => []),
          gitBranches(workspacePath, connectionId).catch(() => []),
        ]);
        setHistory(logResult);
        setBranches(branchResult);
      } catch (err) {
        setError(parsePuckError(err).message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [connectionId, workspacePath],
  );

  useEffect(() => {
    if (!isLocal && (!connectionId || remoteStatus !== "connected")) return;
    void refresh();
  }, [connectionId, isLocal, refresh, activeSession?.id, remoteStatus]);

  // Refresh silently when the workspace changes on disk (e.g. a file saved
  // from the editor), avoiding the loading spinner flicker.
  // 工作区磁盘变化时静默刷新（例如编辑器保存文件），避免 loading 闪烁。
  useWorkspaceWatch(isLocal ? workspacePath : null, () => {
    void refresh(true);
  });

  const openDiff = useCallback(
    async (file: string, staged: boolean) => {
      const owningWorkspaceId = activeSession?.workspaceId;
      try {
        const original = staged
          ? (await gitBlobContent(workspacePath, file, "head", connectionId)) ?? ""
          : (await gitBlobContent(workspacePath, file, "index", connectionId)) ?? "";
        let modified: string;
        if (staged) {
          modified = (await gitBlobContent(workspacePath, file, "index", connectionId)) ?? "";
        } else if (connectionId && activeSession) {
          const profile = useConnectionStore.getState().getProfile(connectionId);
          if (!profile) throw new Error("SSH profile not found");
          await ensureSftpExplorerSession(activeSession.id, profile);
          modified = await readRemoteFile(
            explorerSftpSessionId(activeSession.id),
            joinWorkspacePath(workspacePath, file),
          );
        } else {
          modified = await readLocalFile(joinWorkspacePath(workspacePath, file));
        }

        const diffId = `diff:${connectionId ?? "local"}:${workspacePath}:${file}:${
          staged ? "staged" : "worktree"
        }`;
        setDiffContent(diffId, original, modified);
        useWorkbenchStore.getState().openDiffTab({
          kind: "diff",
          id: diffId,
          title: fileNameFromPath(file),
          path: file,
          language: guessMonacoLanguage(file),
          workspaceId: owningWorkspaceId,
        });
      } catch (err) {
        toast.error(parsePuckError(err).message);
      }
    },
    [activeSession?.workspaceId, connectionId, workspacePath],
  );

  const runAction = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
        await refresh();
      } catch (err) {
        toast.error(parsePuckError(err).message);
      }
    },
    [refresh],
  );

  const openGraph = useCallback(() => {
    const workspaceId = activeSession?.workspaceId ?? `legacy:${workspacePath}`;
    useWorkbenchStore.getState().openGitGraphTab({
      kind: "gitGraph",
      id: `git-graph:${workspaceId}`,
      title: "Git Graph",
      path: workspacePath,
      source: workspace?.source ?? "local",
      workspaceId,
      connectionId,
    });
  }, [activeSession?.workspaceId, connectionId, workspace?.source, workspacePath]);

  const commit = useCallback(async () => {
    if (!commitMessage.trim() || committing) return;
    setCommitting(true);
    try {
      await gitCommit(workspacePath, commitMessage, connectionId);
      setCommitMessage("");
      await refresh();
    } catch (err) {
      toast.error(parsePuckError(err).message);
    } finally {
      setCommitting(false);
    }
  }, [commitMessage, committing, connectionId, refresh, workspacePath]);

  const switchBranch = useCallback(
    async (branch: string) => {
      await runAction(async () => {
        await gitCheckout(workspacePath, branch, connectionId);
      });
    },
    [connectionId, runAction, workspacePath],
  );

  const writeCommandToTerminal = useCallback(
    (command: string) => {
      if (!activeSession) return;
      const sessions = useSessionStore.getState().sessions;
      const terminal = sessions.some((session) => session.id === activeSession.id)
        ? activeSession
        : sessions.find(
            (session) =>
              session.kind === "terminal" &&
              session.workspaceId === activeSession.workspaceId,
          );
      if (!terminal) {
        toast.error(t("gitRetryFailed"));
        return;
      }
      void writeTerminal(terminal.id, command).catch(() => {
        toast.error(t("gitRetryFailed"));
      });
    },
    [activeSession, t],
  );

  const runNetwork = useCallback(
    async (command: "fetch" | "pull" | "push", doneLabel: string) => {
      try {
        const result =
          command === "fetch"
            ? await gitFetch(workspacePath, connectionId)
            : command === "pull"
              ? await gitPull(workspacePath, connectionId)
              : await gitPush(workspacePath, connectionId);

        if (result.ok) {
          toast.success(doneLabel);
          await refresh();
          return;
        }

        const kind = result.errorKind as GitNetworkErrorKind | undefined;
        const title =
          kind === "auth"
            ? t("gitAuthFailed")
            : kind === "no_upstream"
              ? t("gitNoUpstream")
              : t("gitNetworkFailed");
        // Expected failures (auth/network) offer a terminal fallback so the
        // user can enter credentials interactively; the git command is typed
        // into the active terminal session.
        // 预期失败（认证/网络）提供终端降级入口，用户可在终端交互输入凭据；
        // 对应命令会写入当前活动的终端会话。
        toast.error(title, {
          description: result.message,
          action: {
            label: t("gitRetryInTerminal"),
            onClick: () => writeCommandToTerminal(`git ${command}\n`),
          },
        });
      } catch (err) {
        toast.error(parsePuckError(err).message);
      }
    },
    [connectionId, refresh, t, workspacePath, writeCommandToTerminal],
  );

  if (!activeSession || activeSession.kind !== "terminal") {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        {t("noActiveTerminal")}
      </div>
    );
  }

  if (!loading && status && !status.isRepo) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-end border-b border-border/60 px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("refresh")}
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCwIcon className={cn(loading && "animate-spin")} />
          </Button>
        </div>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("notAGitRepo")}
        </div>
      </div>
    );
  }

  const stagedFiles = status?.staged ?? [];
  const unstagedFiles = status?.unstaged ?? [];
  const untrackedFiles = status?.untracked ?? [];
  const hasChanges =
    stagedFiles.length > 0 ||
    unstagedFiles.length > 0 ||
    untrackedFiles.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-sm hover:bg-background/60"
                aria-label={t("gitSwitchBranch")}
                title={t("gitSwitchBranch")}
              >
                <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">
                  {status?.branch || t("detachedHead")}
                </span>
                {status?.ahead || status?.behind ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("gitAheadBehind", {
                      ahead: status.ahead ?? 0,
                      behind: status.behind ?? 0,
                    })}
                  </span>
                ) : null}
                <ChevronDownIcon className="size-3 shrink-0 opacity-60" />
              </button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{t("gitSwitchBranch")}</DropdownMenuLabel>
            {branches.map((branch) => (
              <DropdownMenuItem
                key={branch.name}
                disabled={branch.isCurrent}
                onClick={() => void switchBranch(branch.name)}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs">
                  {branch.name}
                </span>
                {branch.isCurrent ? (
                  <CheckIcon className="size-3.5 shrink-0" />
                ) : null}
              </DropdownMenuItem>
            ))}
            {branches.length === 0 ? (
              <DropdownMenuItem disabled>
                {t("detachedHead")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("gitFetch")}
            title={t("gitFetch")}
            disabled={loading}
            onClick={() =>
              void runNetwork("fetch", t("gitFetchDone"))
            }
          >
            <DownloadIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("gitPull")}
            title={t("gitPull")}
            disabled={loading}
            onClick={() =>
              void runNetwork("pull", t("gitPullDone"))
            }
          >
            <ArrowDownToLineIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("gitPush")}
            title={t("gitPush")}
            disabled={loading}
            onClick={() =>
              void runNetwork("push", t("gitPushDone"))
            }
          >
            <UploadIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Git Graph"
            title="Git Graph"
            onClick={openGraph}
          >
            <GitForkIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("refresh")}
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCwIcon className={cn(loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="px-3 py-2 text-xs text-destructive">{error}</div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-1 py-3">
          <GitSection title={t("gitStaged")} count={stagedFiles.length}>
            {stagedFiles.map((file) => (
              <GitFileRow
                key={file.path}
                file={file}
                clickable
                onOpenDiff={() => void openDiff(file.path, true)}
                actions={
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("gitUnstage")}
                      title={t("gitUnstage")}
                      onClick={() =>
                        void runAction(() =>
                          gitUnstage(workspacePath, [file.path], connectionId),
                        )
                      }
                    >
                      <ArrowDownIcon />
                    </Button>
                  </>
                }
              />
            ))}
          </GitSection>

          <GitSection title={t("gitUnstaged")} count={unstagedFiles.length}>
            {unstagedFiles.map((file) => {
              const unmerged =
                file.indexStatus.trim().toUpperCase() === "U" ||
                file.worktreeStatus.trim().toUpperCase() === "U";
              return (
                <GitFileRow
                  key={file.path}
                  file={file}
                  clickable
                  onOpenDiff={() => void openDiff(file.path, false)}
                  actions={
                    <>
                      {!unmerged ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("gitStage")}
                            title={t("gitStage")}
                            onClick={() =>
                              void runAction(() =>
                                gitStage(workspacePath, [file.path], connectionId),
                              )
                            }
                          >
                            <ArrowUpIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("gitDiscard")}
                            title={t("gitDiscard")}
                            onClick={() => {
                              if (!window.confirm(t("gitDiscardConfirm", { file: file.path }))) {
                                return;
                              }
                              void runAction(() =>
                                gitDiscard(workspacePath, [file.path], connectionId),
                              );
                            }}
                          >
                            <Undo2Icon />
                          </Button>
                        </>
                      ) : null}
                    </>
                  }
                />
              );
            })}
          </GitSection>

          <GitSection title={t("gitUntracked")} count={untrackedFiles.length}>
            {untrackedFiles.map((path) => (
              <div
                key={path}
                className="group flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-background/60"
              >
                <span className="w-4 shrink-0 font-mono text-muted-foreground">
                  ?
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-mono"
                  title={path}
                >
                  {path}
                </span>
                <div className="flex shrink-0 items-center gap-0.5 opacity-60 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("gitStage")}
                    title={t("gitStage")}
                    onClick={() =>
                      void runAction(() => gitStage(workspacePath, [path], connectionId))
                    }
                  >
                    <ArrowUpIcon />
                  </Button>
                </div>
              </div>
            ))}
          </GitSection>

          {!loading && !hasChanges ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              {t("gitClean")}
            </div>
          ) : null}

          <GitSection title={t("gitHistory")} count={history.length}>
            {history.map((entry) => (
              <div
                key={entry.hash}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
              >
                <span className="w-9 shrink-0 font-mono text-muted-foreground">
                  {entry.shortHash}
                </span>
                <span
                  className="min-w-0 flex-1 truncate"
                  title={entry.subject}
                >
                  {entry.subject}
                </span>
                <span
                  className="shrink-0 text-[10px] text-muted-foreground"
                  title={`${entry.author} · ${entry.date}`}
                >
                  {entry.author}
                </span>
              </div>
            ))}
          </GitSection>
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 p-2">
        <textarea
          value={commitMessage}
          placeholder={t("gitCommitPlaceholder")}
          rows={2}
          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          onChange={(event) => setCommitMessage(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void commit();
            }
          }}
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            {t("gitCommitHint")}
          </span>
          <Button
            size="xs"
            disabled={stagedFiles.length === 0 || !commitMessage.trim() || committing}
            onClick={() => void commit()}
          >
            {t("gitCommit")}
          </Button>
        </div>
      </div>
    </div>
  );
}

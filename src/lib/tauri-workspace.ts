import { invoke } from "@tauri-apps/api/core";
import { isRecord } from "@/lib/ipc-parse";
import type { GitStatusResult, LocalFileEntry } from "@/types/workspace";

function parseLocalFileEntry(value: unknown): LocalFileEntry | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.name !== "string" ||
    typeof value.path !== "string" ||
    typeof value.isDir !== "boolean" ||
    typeof value.size !== "number"
  ) {
    return null;
  }
  return {
    name: value.name,
    path: value.path,
    isDir: value.isDir,
    size: value.size,
    modified: typeof value.modified === "number" ? value.modified : undefined,
  };
}

function parseLocalFileEntries(value: unknown): LocalFileEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => parseLocalFileEntry(item))
    .filter((item): item is LocalFileEntry => item !== null);
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
  };
}

function parseGitStatusResult(value: unknown): GitStatusResult {
  if (!isRecord(value) || typeof value.isRepo !== "boolean") {
    throw new Error("Invalid git status response");
  }

  const staged = Array.isArray(value.staged)
    ? value.staged
        .map((item) => parseGitFileStatus(item))
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const unstaged = Array.isArray(value.unstaged)
    ? value.unstaged
        .map((item) => parseGitFileStatus(item))
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const untracked = Array.isArray(value.untracked)
    ? value.untracked.filter((item): item is string => typeof item === "string")
    : [];

  return {
    isRepo: value.isRepo,
    branch: typeof value.branch === "string" ? value.branch : undefined,
    staged,
    unstaged,
    untracked,
  };
}

export async function listLocalDir(
  path: string,
  showHidden = false,
): Promise<LocalFileEntry[]> {
  const result = await invoke<unknown>("list_local_dir", { path, showHidden });
  return parseLocalFileEntries(result);
}

export async function gitStatus(path: string): Promise<GitStatusResult> {
  const result = await invoke<unknown>("git_status", { path });
  return parseGitStatusResult(result);
}

export async function readLocalFile(path: string): Promise<string> {
  const result = await invoke<unknown>("read_local_file", { path });
  if (typeof result !== "string") {
    throw new Error("Invalid read local file response");
  }
  return result;
}

export function writeLocalFile(path: string, content: string): Promise<void> {
  return invoke("write_local_file", { path, content });
}

/**
 * IPC wrappers for local workspace filesystem access.
 *
 * 本地工作区文件系统的 IPC 封装：目录列表、文件读写（底层带原子写保护）。
 * Git 相关命令统一收口在 `src/lib/tauri-git.ts`。
 */
import { invoke } from "@tauri-apps/api/core";
import { isRecord } from "@/lib/ipc-parse";
import type { LocalFileEntry } from "@/types/workspace";

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

export async function listLocalDir(
  path: string,
  showHidden = false,
): Promise<LocalFileEntry[]> {
  const result = await invoke<unknown>("list_local_dir", { path, showHidden });
  return parseLocalFileEntries(result);
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

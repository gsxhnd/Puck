import { invoke } from "@tauri-apps/api/core";
import type { GitStatusResult, LocalFileEntry } from "@/types/workspace";

export function listLocalDir(
  path: string,
  showHidden = false,
): Promise<LocalFileEntry[]> {
  return invoke<LocalFileEntry[]>("list_local_dir", { path, showHidden });
}

export function gitStatus(path: string): Promise<GitStatusResult> {
  return invoke<GitStatusResult>("git_status", { path });
}

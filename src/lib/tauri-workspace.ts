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

export function readLocalFile(path: string): Promise<string> {
  return invoke<string>("read_local_file", { path });
}

export function writeLocalFile(path: string, content: string): Promise<void> {
  return invoke("write_local_file", { path, content });
}

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/platform";

export type OpenInAppId =
  | "vscode"
  | "cursor"
  | "xcode"
  | "zed"
  | "finder"
  | "terminal";

export async function openPathInApp(
  path: string,
  app: OpenInAppId,
): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await invoke("open_path_in_app", { path, app });
}

import { getAppWindowMode } from "@/lib/app-window";
import { isTauri } from "@/lib/platform";

export async function exitApp(): Promise<void> {
  if (getAppWindowMode() !== "main") return;

  if (!isTauri()) {
    window.close();
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

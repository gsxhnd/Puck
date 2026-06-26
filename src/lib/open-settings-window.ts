import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { buildSettingsWindowUrl } from "@/lib/app-window";
import { isTauri } from "@/lib/platform";

export async function openSettingsWindow(): Promise<void> {
  if (!isTauri()) {
    const opened = window.open(
      buildSettingsWindowUrl(),
      "settings",
      "popup,width=800,height=640",
    );
    opened?.focus();
    return;
  }

  try {
    await invoke("open_settings_window");
  } catch (error) {
    console.error("Failed to open settings window:", error);
    toast.error(String(error));
  }
}

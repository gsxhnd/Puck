import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import i18n from "@/i18n";
import { buildSettingsWindowUrl } from "@/lib/app-window";
import { formatPuckErrorMessage } from "@/lib/puck-error";
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
    toast.error(formatPuckErrorMessage(i18n.t.bind(i18n), error));
  }
}

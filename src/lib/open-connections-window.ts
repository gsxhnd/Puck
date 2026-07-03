import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import i18n from "@/i18n";
import { buildConnectionsWindowUrl } from "@/lib/app-window";
import { formatPuckErrorMessage } from "@/lib/puck-error";
import { isTauri } from "@/lib/platform";

export async function openConnectionsWindow(): Promise<void> {
  if (!isTauri()) {
    const opened = window.open(
      buildConnectionsWindowUrl(),
      "connections",
      "popup,width=720,height=560",
    );
    opened?.focus();
    return;
  }

  try {
    await invoke("open_connections_window");
  } catch (error) {
    console.error("Failed to open connections window:", error);
    toast.error(formatPuckErrorMessage(i18n.t.bind(i18n), error));
  }
}

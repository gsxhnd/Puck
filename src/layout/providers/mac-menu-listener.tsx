import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getAppWindowMode } from "@/lib/app-window";
import { handleMenuAction } from "@/lib/handle-menu-action";
import { getPlatform, isTauri } from "@/lib/platform";

/** Listen for native macOS menu bar actions on the main window. */
export function MacMenuListener() {
  useEffect(() => {
    if (!isTauri() || getPlatform() !== "macos" || getAppWindowMode() !== "main") {
      return;
    }

    const unlisten = listen<string>("puck:menu-action", (event) => {
      handleMenuAction(event.payload);
    });

    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  return null;
}

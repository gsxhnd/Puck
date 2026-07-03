import { useEffect } from "react";
import { getAppWindowMode } from "@/lib/app-window";
import { handleMenuAction } from "@/lib/handle-menu-action";
import { listenWithCleanup } from "@/lib/tauri-listener";
import { isTauri } from "@/lib/platform";

/** Listen for native menu bar actions on the main window. */
export function AppMenuListener() {
  useEffect(() => {
    if (!isTauri() || getAppWindowMode() !== "main") {
      return;
    }

    return listenWithCleanup<string>("puck:menu-action", (event) => {
      if (typeof event.payload === "string") {
        handleMenuAction(event.payload);
      }
    });
  }, []);

  return null;
}

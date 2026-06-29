import { useCallback } from "react";
import { isTauri } from "@/lib/platform";

/** Elements that must not start a window drag when inside `.window-title-bar`. */
const TITLE_BAR_NO_DRAG_SELECTOR =
  "button, input, textarea, select, a, [role='button'], .window-title-bar-interactive, [data-slot='popover-trigger']";

export function useWindowDragRegion() {
  return useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!isTauri() || event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest(TITLE_BAR_NO_DRAG_SELECTOR)) return;

    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();

      if (event.detail === 2) {
        await appWindow.toggleMaximize();
        return;
      }

      await appWindow.startDragging();
    })();
  }, []);
}

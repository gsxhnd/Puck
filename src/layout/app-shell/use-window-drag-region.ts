import { useCallback } from "react";
import { isTauri } from "@/lib/platform";

export function useWindowDragRegion() {
  return useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!isTauri() || event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button")) return;

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

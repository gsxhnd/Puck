import { useCallback } from "react";
import { WindowControls } from "@/components/app-shell/window-controls";
import { MacTrafficLights } from "@/components/app-shell/mac-traffic-lights";
import { getPlatform, isTauri } from "@/lib/platform";
import { cn } from "@/lib/utils";

export function WindowTitleBar() {
  const platform = getPlatform();

  const handleDragRegionMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
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
    },
    [],
  );

  return (
    <header
      data-platform={platform}
      className={cn(
        "window-title-bar relative flex h-[var(--titlebar-height)] shrink-0 items-stretch border-b border-border/80 bg-background select-none",
      )}
      onMouseDown={handleDragRegionMouseDown}
    >
      {platform === "macos" ? <MacTrafficLights /> : null}

      <div className="min-w-0 flex-1" />

      {platform !== "macos" ? <WindowControls /> : null}
    </header>
  );
}

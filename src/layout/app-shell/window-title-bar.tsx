import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { WindowControls } from "@/layout/app-shell/window-controls";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getPlatform, isTauri } from "@/lib/platform";
import { cn } from "@/lib/utils";

type WindowTitleBarProps = {
  leftSidebarOpen?: boolean;
  rightSidebarOpen?: boolean;
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
};

export function WindowTitleBar({
  leftSidebarOpen = true,
  rightSidebarOpen = false,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}: WindowTitleBarProps) {
  const { t } = useTranslation("common");
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
        "window-title-bar relative flex h-[var(--titlebar-height)] shrink-0 items-stretch bg-background select-none",
      )}
      onMouseDown={handleDragRegionMouseDown}
    >
      {platform === "macos" ? (
        <div
          className="shrink-0"
          style={{ width: "var(--titlebar-macos-inset)" }}
        />
      ) : null}

      {onToggleLeftSidebar ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "ml-1 my-auto",
                  !leftSidebarOpen && "text-muted-foreground",
                )}
                aria-label={t("nav.togglePrimaryPanel")}
                onClick={onToggleLeftSidebar}
              >
                <PanelLeftIcon />
              </Button>
            }
          />
          <TooltipContent side="bottom">
            {t("nav.togglePrimaryPanel")}
          </TooltipContent>
        </Tooltip>
      ) : null}

      <div className="min-w-0 flex-1" />

      {onToggleRightSidebar ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "mr-1 my-auto",
                  !rightSidebarOpen && "text-muted-foreground",
                )}
                aria-label={t("nav.toggleSecondaryPanel")}
                onClick={onToggleRightSidebar}
              >
                <PanelRightIcon />
              </Button>
            }
          />
          <TooltipContent side="bottom">
            {t("nav.toggleSecondaryPanel")}
          </TooltipContent>
        </Tooltip>
      ) : null}

      {platform !== "macos" ? <WindowControls /> : null}
    </header>
  );
}

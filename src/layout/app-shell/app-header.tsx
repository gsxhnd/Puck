/**
 * Full-width header island: window drag region, sidebar toggle and window
 * controls. Workspace switching intentionally lives in the sidebar.
 *
 * 顶部整宽标题岛：窗口拖拽区、侧栏开关与（非 macOS）窗口控制按钮。工作区
 * 切换入口位于侧栏，不放在这里。
 */
import { useTranslation } from "react-i18next";
import { PanelLeftIcon } from "lucide-react";
import { getPlatform } from "@/lib/platform";
import { useWindowDragRegion } from "@/layout/app-shell/use-window-drag-region";
import { WindowControls } from "@/layout/app-shell/window-controls";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { t } = useTranslation("common");
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen);
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);
  const platform = getPlatform();
  const onMouseDown = useWindowDragRegion();

  return (
    <header
      data-platform={platform}
      // Full-bleed strip on the shell base; the border below separates it
      // from the islanded content without creating a floating gap.
      // 通栏贴边条，底色与外壳一致；仅用下边线与内容区分隔，不产生悬浮间隙。
      className="window-title-bar flex h-9 shrink-0 items-center gap-1 border-b border-border/60 px-2 select-none"
      onMouseDown={onMouseDown}
    >
      {platform === "macos" ? (
        <div
          className="shrink-0"
          style={{ width: "var(--titlebar-macos-inset)" }}
        />
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("workspace.toggleSidebar")}
        title={t("workspace.toggleSidebar")}
        aria-pressed={sidebarOpen}
        onClick={toggleSidebar}
      >
        <PanelLeftIcon />
      </Button>
      <div className="window-title-bar-interactive ml-auto flex shrink-0 items-center gap-0.5">
        {platform !== "macos" ? <WindowControls /> : null}
      </div>
    </header>
  );
}

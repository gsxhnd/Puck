import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PanelHeader } from "@/layout/app-shell/panel-header";
import { MAIN_PANEL_TOOLBAR_SLOT_ID } from "@/layout/app-shell/main-panel-toolbar-slot";
import {
  SidebarHeaderActions,
  type SidebarHeaderActionsProps,
} from "@/layout/app-shell/primary-panel/sidebar-actions";

/**
 * Header of the primary panel; relocates its toolbar when collapsed.
 *
 * 主侧栏头部。展开时直接渲染在侧栏顶部的标题栏内；折叠时侧栏标题栏消失，
 * 此时通过 React Portal 把动作工具栏挂载到主面板预留的插槽
 * (`MAIN_PANEL_TOOLBAR_SLOT_ID`) 中，使新建/折叠按钮仍可访问。
 */
export function PrimaryPanelHeader({
  collapsed,
  onToggleCollapsed,
  ...actions
}: SidebarHeaderActionsProps & {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
}) {
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!collapsed) {
      setToolbarSlot(null);
      return;
    }
    setToolbarSlot(document.getElementById(MAIN_PANEL_TOOLBAR_SLOT_ID));
  }, [collapsed]);

  const toolbar = (
    <div className="flex items-center gap-0.5">
      <SidebarHeaderActions
        {...actions}
        collapsed={collapsed}
        showSort={!collapsed}
        showToggle
        onToggleCollapsed={onToggleCollapsed}
        menuAlign={collapsed ? "start" : "end"}
      />
    </div>
  );

  return (
    <>
      {!collapsed ? (
        <PanelHeader macosInset trailing={toolbar} />
      ) : null}
      {collapsed && toolbarSlot ? createPortal(toolbar, toolbarSlot) : null}
    </>
  );
}

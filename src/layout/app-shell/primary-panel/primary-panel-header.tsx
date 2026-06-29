import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { PanelLeftIcon } from "lucide-react";
import { PanelHeader } from "@/layout/app-shell/panel-header";
import { MAIN_PANEL_TOOLBAR_SLOT_ID } from "@/layout/app-shell/main-panel-toolbar-slot";
import {
  SidebarCollapsedActions,
  type SidebarCollapsedActionsProps,
} from "@/layout/app-shell/primary-panel/sidebar-actions";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PrimaryPanelHeaderProps = SidebarCollapsedActionsProps & {
  collapsed: boolean;
};

export function PrimaryPanelHeader({
  collapsed,
  onToggleCollapsed,
  ...actions
}: PrimaryPanelHeaderProps) {
  const { t } = useTranslation("common");
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!collapsed) {
      setToolbarSlot(null);
      return;
    }
    setToolbarSlot(document.getElementById(MAIN_PANEL_TOOLBAR_SLOT_ID));
  }, [collapsed]);

  const collapseToggle = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground/75"
            aria-label={t("nav.togglePrimaryPanel")}
            onClick={onToggleCollapsed}
          >
            <PanelLeftIcon />
          </Button>
        }
      />
      <TooltipContent side="bottom">
        {t("nav.togglePrimaryPanel")}
      </TooltipContent>
    </Tooltip>
  );

  const collapsedToolbar = (
    <div className="flex items-center gap-0.5">
      <SidebarCollapsedActions
        {...actions}
        onToggleCollapsed={onToggleCollapsed}
      />
    </div>
  );

  return (
    <>
      {!collapsed ? (
        <PanelHeader
          macosInset
          trailing={collapseToggle}
          className="bg-transparent"
        />
      ) : null}
      {collapsed && toolbarSlot ? createPortal(collapsedToolbar, toolbarSlot) : null}
    </>
  );
}

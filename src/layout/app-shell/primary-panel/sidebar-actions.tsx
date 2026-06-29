import { useTranslation } from "react-i18next";
import { PanelLeftIcon, PlusIcon, SquareTerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PrimaryPanelTab } from "@/types/shell-ui";
import { sidebarPanelIconClass } from "@/layout/app-shell/primary-panel/sidebar-panel-toolbar";

function SidebarCollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle?: () => void;
}) {
  const { t } = useTranslation("common");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(sidebarPanelIconClass, collapsed && "text-muted-foreground")}
            aria-label={t("nav.togglePrimaryPanel")}
            onClick={onToggle}
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
}

export type SidebarCollapsedActionsProps = {
  tab: PrimaryPanelTab;
  onToggleCollapsed?: () => void;
  onPrimaryAdd: () => void;
  onOpenTerminalPalette: () => void;
};

export function SidebarCollapsedActions({
  tab,
  onToggleCollapsed,
  onPrimaryAdd,
  onOpenTerminalPalette,
}: SidebarCollapsedActionsProps) {
  const { t } = useTranslation(["common", "commandPalette"]);

  const primaryAddLabel =
    tab === "hosts"
      ? t("common:actions.newConnection")
      : t("common:actions.newTerminal");

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className={sidebarPanelIconClass}
              aria-label={primaryAddLabel}
              onClick={onPrimaryAdd}
            >
              <PlusIcon />
            </Button>
          }
        />
        <TooltipContent side="bottom">{primaryAddLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className={sidebarPanelIconClass}
              aria-label={t("commandPalette:commands.pickTerminal")}
              onClick={onOpenTerminalPalette}
            >
              <SquareTerminalIcon />
            </Button>
          }
        />
        <TooltipContent side="bottom">
          {t("commandPalette:commands.pickTerminal")}
        </TooltipContent>
      </Tooltip>
      <SidebarCollapseToggle collapsed onToggle={onToggleCollapsed} />
    </>
  );
}

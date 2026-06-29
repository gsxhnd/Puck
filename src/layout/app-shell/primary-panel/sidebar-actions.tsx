import { useTranslation } from "react-i18next";
import { PanelLeftIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PrimaryPanelTab } from "@/types/shell-ui";
import { sidebarPanelIconClass } from "@/layout/app-shell/primary-panel/sidebar-panel-toolbar";
import type { ShellInfo } from "@/types/shell";

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
  shells: ShellInfo[];
  onToggleCollapsed?: () => void;
  onQuickConnect: () => void;
  onNewConnection: () => void;
  onCreateGroup: () => void;
  onCreateHostGroup: () => void;
  onOpenDefaultTerminal: () => void;
  onOpenShellTerminal: (shell: ShellInfo) => void;
};

export function SidebarCollapsedActions({
  tab,
  shells,
  onToggleCollapsed,
  onQuickConnect,
  onNewConnection,
  onCreateGroup,
  onCreateHostGroup,
  onOpenDefaultTerminal,
  onOpenShellTerminal,
}: SidebarCollapsedActionsProps) {
  const { t } = useTranslation(["connections", "common", "terminal"]);

  const newMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={sidebarPanelIconClass}
            aria-label={t("connections:newMenu.quickConnect")}
          >
            <PlusIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        {tab === "hosts" ? (
          <>
            <DropdownMenuItem onClick={onNewConnection}>
              {t("common:actions.newConnection")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onQuickConnect}>
              {t("connections:newMenu.quickConnect")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateHostGroup}>
              {t("connections:sidebarGroups.new")}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={onQuickConnect}>
              {t("connections:newMenu.quickConnect")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateGroup}>
              {t("connections:sidebarGroups.new")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {t("connections:newMenu.localTerminal")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuItem onClick={onOpenDefaultTerminal}>
                  {t("terminal:localDefault")}
                </DropdownMenuItem>
                {shells.map((shell) => (
                  <DropdownMenuItem
                    key={shell.id}
                    onClick={() => onOpenShellTerminal(shell)}
                  >
                    <span className="truncate">{shell.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground uppercase">
                      {shell.kind}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {newMenu}
      <SidebarCollapseToggle collapsed onToggle={onToggleCollapsed} />
    </>
  );
}

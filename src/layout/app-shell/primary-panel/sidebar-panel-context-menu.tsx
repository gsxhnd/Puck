import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PlusIcon, SquareTerminalIcon } from "lucide-react";
import type { PrimaryPanelTab } from "@/types/shell-ui";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function SidebarPanelContextMenu({
  tab,
  children,
  onPrimaryAdd,
  onOpenTerminalPalette,
  onQuickConnect,
  onCreateGroup,
}: {
  tab: PrimaryPanelTab;
  children: ReactNode;
  onPrimaryAdd: () => void;
  onOpenTerminalPalette: () => void;
  onQuickConnect: () => void;
  onCreateGroup: () => void;
}) {
  const { t } = useTranslation(["connections", "common", "commandPalette"]);

  const primaryLabel =
    tab === "hosts"
      ? t("common:actions.newConnection")
      : t("common:actions.newTerminal");

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="min-h-full">{children}</div>} />
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onPrimaryAdd}>
          <PlusIcon />
          {primaryLabel}
        </ContextMenuItem>
        <ContextMenuItem onClick={onOpenTerminalPalette}>
          <SquareTerminalIcon />
          {t("commandPalette:commands.pickTerminal")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onQuickConnect}>
          {t("connections:newMenu.quickConnect")}
        </ContextMenuItem>
        <ContextMenuItem onClick={onCreateGroup}>
          {t("connections:sidebarGroups.new")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

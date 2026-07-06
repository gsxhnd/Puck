import { useTranslation } from "react-i18next";
import { ListFilterIcon, PlusIcon, SquareTerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HostSort } from "@/lib/hosts-groups";
import type { SessionSort } from "@/lib/sidebar-groups";
import type { PrimaryPanelTab } from "@/types/shell-ui";

export const sidebarPanelIconClass =
  "text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground/75";

export type SidebarPanelToolbarProps = {
  tab: PrimaryPanelTab;
  sort: SessionSort;
  setSort: (sort: SessionSort) => void;
  hostSort: HostSort;
  setHostSort: (sort: HostSort) => void;
  sessionGroupingEnabled: boolean;
  setSessionGroupingEnabled: (enabled: boolean) => void;
  hostGroupingEnabled: boolean;
  setHostGroupingEnabled: (enabled: boolean) => void;
  onPrimaryAdd: () => void;
  onOpenTerminalPalette: () => void;
};

export function SidebarPanelToolbar({
  tab,
  sort,
  setSort,
  hostSort,
  setHostSort,
  sessionGroupingEnabled,
  setSessionGroupingEnabled,
  hostGroupingEnabled,
  setHostGroupingEnabled,
  onPrimaryAdd,
  onOpenTerminalPalette,
}: SidebarPanelToolbarProps) {
  const { t } = useTranslation(["connections", "common", "terminal", "commandPalette"]);

  const sortMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={sidebarPanelIconClass}
            aria-label={t("connections:sort.label")}
          >
            <ListFilterIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {tab === "sessions" ? (
          <>
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => setSort(value as SessionSort)}
            >
              <DropdownMenuLabel>{t("connections:sort.label")}</DropdownMenuLabel>
              <DropdownMenuRadioItem value="recent">
                {t("connections:sort.recent")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="nameAsc">
                {t("connections:sort.nameAsc")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="nameDesc">
                {t("connections:sort.nameDesc")}
              </DropdownMenuRadioItem>
              {sort === "custom" ? (
                <DropdownMenuRadioItem value="custom">
                  {t("connections:sort.custom")}
                </DropdownMenuRadioItem>
              ) : null}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={sessionGroupingEnabled}
              onCheckedChange={(checked) =>
                setSessionGroupingEnabled(checked === true)
              }
            >
              {t("connections:sort.grouped")}
            </DropdownMenuCheckboxItem>
          </>
        ) : (
          <>
            <DropdownMenuRadioGroup
              value={hostSort}
              onValueChange={(value) => setHostSort(value as HostSort)}
            >
              <DropdownMenuLabel>{t("connections:sort.label")}</DropdownMenuLabel>
              <DropdownMenuRadioItem value="nameAsc">
                {t("connections:sort.nameAsc")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="nameDesc">
                {t("connections:sort.nameDesc")}
              </DropdownMenuRadioItem>
              {hostSort === "custom" ? (
                <DropdownMenuRadioItem value="custom">
                  {t("connections:sort.custom")}
                </DropdownMenuRadioItem>
              ) : null}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={hostGroupingEnabled}
              onCheckedChange={(checked) =>
                setHostGroupingEnabled(checked === true)
              }
            >
              {t("connections:sort.grouped")}
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const primaryAddLabel =
    tab === "hosts"
      ? t("common:actions.newConnection")
      : t("common:actions.newTerminal");

  const addButton = (
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
  );

  const terminalPickerButton = (
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
  );

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {sortMenu}
      {addButton}
      {terminalPickerButton}
    </div>
  );
}

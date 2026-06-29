import { useTranslation } from "react-i18next";
import { ListFilterIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HostSort } from "@/lib/hosts-groups";
import type { SessionSort } from "@/lib/sidebar-groups";
import type { PrimaryPanelTab } from "@/types/shell-ui";
import type { ShellInfo } from "@/types/shell";

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
  shells: ShellInfo[];
  onQuickConnect: () => void;
  onNewConnection: () => void;
  onCreateGroup: () => void;
  onCreateHostGroup: () => void;
  onOpenDefaultTerminal: () => void;
  onOpenShellTerminal: (shell: ShellInfo) => void;
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
  shells,
  onQuickConnect,
  onNewConnection,
  onCreateGroup,
  onCreateHostGroup,
  onOpenDefaultTerminal,
  onOpenShellTerminal,
}: SidebarPanelToolbarProps) {
  const { t } = useTranslation(["connections", "common", "terminal"]);

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
      <DropdownMenuContent align="end" className="w-56">
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
      {sortMenu}
      {newMenu}
    </>
  );
}

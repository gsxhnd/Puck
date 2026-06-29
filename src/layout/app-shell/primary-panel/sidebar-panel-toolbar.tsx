import { useTranslation } from "react-i18next";
import { ListFilterIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
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
import type { SessionSort } from "@/lib/sidebar-groups";
import type { ShellInfo } from "@/types/shell";

export const sidebarPanelIconClass =
  "text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground/75";

export type PrimaryPanelTab = "sessions" | "hosts";

export type SidebarPanelToolbarProps = {
  tab: PrimaryPanelTab;
  sort: SessionSort;
  setSort: (sort: SessionSort) => void;
  shells: ShellInfo[];
  onQuickConnect: () => void;
  onNewConnection: () => void;
  onCreateGroup: () => void;
  onOpenDefaultTerminal: () => void;
  onOpenShellTerminal: (shell: ShellInfo) => void;
};

export function SidebarPanelToolbar({
  tab,
  sort,
  setSort,
  shells,
  onQuickConnect,
  onNewConnection,
  onCreateGroup,
  onOpenDefaultTerminal,
  onOpenShellTerminal,
}: SidebarPanelToolbarProps) {
  const { t } = useTranslation(["connections", "common", "terminal"]);

  const sortMenu =
    tab === "sessions" ? (
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
        <DropdownMenuContent align="end" className="w-44">
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
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

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

import { useTranslation } from "react-i18next";
import { ListFilterIcon, PanelLeftIcon, PlusIcon } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SessionSort } from "@/lib/sidebar-groups";
import type { ShellInfo } from "@/types/shell";

/**
 * Shared hover/idle styling for the primary panel header buttons.
 *
 * 主侧栏头部所有图标按钮共用的样式：默认弱化显示，悬停时提升对比度，
 * 使其在标题栏中保持低调但可点击的视觉效果。
 */
export const sidebarHeaderIconClass =
  "text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground/75";

/**
 * Icon button that collapses or expands the primary panel.
 *
 * 用于折叠/展开主侧栏的图标按钮。折叠状态下高亮显示，并通过 Tooltip
 * 提示当前操作；实际的折叠逻辑由父组件通过 `onToggle` 注入。
 */
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
            className={cn(sidebarHeaderIconClass, collapsed && "text-muted-foreground")}
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

/**
 * Props for the cluster of header actions (sort, create, collapse).
 *
 * 主侧栏头部动作区所需的属性集合，统一在折叠态与展开态、以及
 * 内嵌于主面板工具栏时复用，避免重复声明回调签名。
 */
export type SidebarHeaderActionsProps = {
  sort: SessionSort;
  setSort: (sort: SessionSort) => void;
  shells: ShellInfo[];
  showSort?: boolean;
  showToggle?: boolean;
  collapsed?: boolean;
  menuAlign?: "start" | "end";
  onToggleCollapsed?: () => void;
  onCreateConnection: () => void;
  onCreateGroup: () => void;
  onOpenDefaultTerminal: () => void;
  onOpenShellTerminal: (shell: ShellInfo) => void;
  onOpenConnectionsWindow: () => void;
};

/**
 * Renders the sort menu, the "new" menu, and the collapse toggle.
 *
 * 渲染主侧栏头部的三个动作：排序菜单、"新建"菜单（新建连接 / 分组 /
 * 本地终端 / 已保存连接窗口）以及折叠按钮。组件本身无状态，所有数据与
 * 回调均由父组件传入；折叠态下会隐藏排序菜单并切换菜单对齐方向。
 */
export function SidebarHeaderActions({
  sort,
  setSort,
  shells,
  showSort = true,
  showToggle = false,
  collapsed = false,
  menuAlign = "end",
  onToggleCollapsed,
  onCreateConnection,
  onCreateGroup,
  onOpenDefaultTerminal,
  onOpenShellTerminal,
  onOpenConnectionsWindow,
}: SidebarHeaderActionsProps) {
  const { t } = useTranslation(["connections", "common", "terminal"]);

  const sortMenu = showSort ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={sidebarHeaderIconClass}
            aria-label={t("connections:sort.label")}
          >
            <ListFilterIcon />
          </Button>
        }
      />
      <DropdownMenuContent align={menuAlign} className="w-44">
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
            className={sidebarHeaderIconClass}
            aria-label={t("common:actions.newConnection")}
          >
            <PlusIcon />
          </Button>
        }
      />
      <DropdownMenuContent align={menuAlign} className="w-56">
        <DropdownMenuItem onClick={onCreateConnection}>
          {t("common:actions.newConnection")}
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
        <DropdownMenuItem onClick={onOpenConnectionsWindow}>
          {t("connections:newMenu.savedConnections")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const toggle = showToggle ? (
    <SidebarCollapseToggle
      collapsed={collapsed}
      onToggle={onToggleCollapsed}
    />
  ) : null;

  if (collapsed) {
    return (
      <>
        {newMenu}
        {toggle}
      </>
    );
  }

  return (
    <>
      {sortMenu}
      {newMenu}
      {toggle}
    </>
  );
}

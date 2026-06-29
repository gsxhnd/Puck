import { useTranslation } from "react-i18next";
import { useDroppable } from "@dnd-kit/react";
import { ChevronRightIcon } from "lucide-react";
import {
  type SidebarDisplayGroup,
  GROUP_DROP_PREFIX,
} from "@/lib/sidebar-groups";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { SortableSessionTabItem } from "@/layout/app-shell/primary-panel/session-tab-item";

/**
 * Drop target rendered for empty (or custom) groups.
 *
 * 空分组的拖拽落点。当某个分组没有会话时显示完整提示文案，作为拖拽目标；
 * 在自定义分组末尾还会以 `compact` 形式渲染一个更矮的落点，方便把会话
 * 拖入分组尾部。落点高亮由 dnd-kit 的 `isDropTarget` 控制。
 */
function EmptyGroupDropZone({
  groupId,
  compact = false,
}: {
  groupId: string;
  compact?: boolean;
}) {
  const { t } = useTranslation("connections");
  const { ref, isDropTarget } = useDroppable({
    id: `${GROUP_DROP_PREFIX}${groupId}`,
    data: { type: "group", groupId },
  });

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center rounded-md border border-dashed border-transparent text-[11px] text-muted-foreground/70",
        compact ? "min-h-5" : "min-h-7",
        isDropTarget && "border-primary/40 bg-muted/20 text-muted-foreground",
      )}
    >
      {!compact ? t("sidebarGroups.dropHere") : null}
    </div>
  );
}

/**
 * A collapsible group header plus its list of session rows.
 *
 * 主侧栏中的一个分组：可折叠的标题行加上其下的会话列表。自定义分组的标题
 * 提供重命名/删除右键菜单，内置分组则只显示标题。`sessionIndexOffset` 是
 * 该分组首个会话在全局拖拽序列中的偏移量，用于让 dnd-kit 在跨分组排序时
 * 仍能计算出正确的全局索引。
 */
export function SessionGroup({
  group,
  collapsed,
  onToggle,
  onRename,
  onDelete,
  onRenameSession,
  sessionIndexOffset,
}: {
  group: SidebarDisplayGroup;
  collapsed: boolean;
  onToggle: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onRenameSession: (sessionId: string) => void;
  sessionIndexOffset: number;
}) {
  const { t } = useTranslation("connections");

  const header = (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-7 w-full items-center gap-1 rounded-md px-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronRightIcon
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground/50 transition-transform",
          !collapsed && "rotate-90",
        )}
      />
      <span className={cn("truncate", group.isCustom ? "font-medium" : "font-mono")}>
        {group.name}
      </span>
    </button>
  );

  return (
    <div className="space-y-0.5">
      {group.isCustom && (onRename || onDelete) ? (
        <ContextMenu>
          <ContextMenuTrigger render={header} />
          <ContextMenuContent className="w-44">
            {onRename ? (
              <ContextMenuItem onClick={onRename}>
                {t("sidebarGroups.rename")}
              </ContextMenuItem>
            ) : null}
            {onDelete ? (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={onDelete}>
                  {t("sidebarGroups.delete")}
                </ContextMenuItem>
              </>
            ) : null}
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        header
      )}
      {!collapsed ? (
        <div className="space-y-0.5 pl-1">
          {group.sessions.length === 0 ? (
            <EmptyGroupDropZone groupId={group.id} />
          ) : (
            <>
              {group.sessions.map((session, index) => (
                <SortableSessionTabItem
                  key={session.id}
                  session={session}
                  index={sessionIndexOffset + index}
                  onRename={() => onRenameSession(session.id)}
                />
              ))}
              {group.isCustom ? (
                <EmptyGroupDropZone groupId={group.id} compact />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

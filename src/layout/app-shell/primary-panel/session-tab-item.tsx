import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/react/sortable";
import { CopyIcon, PencilIcon, XIcon } from "lucide-react";
import type { Session } from "@/types/connection";
import { useSessionStore } from "@/stores/session-store";
import { formatSidebarLabel, getShellBadge } from "@/lib/session-display";
import { SIDEBAR_SORTABLE_GROUP } from "@/lib/sidebar-groups";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

/**
 * A draggable session row in the primary panel with a context menu.
 *
 * 主侧栏中的单个会话条目。支持拖拽排序（通过 dnd-kit 的 useSortable，
 * `index` 为该会话在全部会话中的全局序号），点击切换激活会话，悬停时
 * 将 shell 徽标替换为关闭按钮，并通过右键菜单提供重命名、复制、关闭、
 * 关闭其它终端等操作。
 */
export function SortableSessionTabItem({
  session,
  index,
  onRename,
}: {
  session: Session;
  index: number;
  onRename?: () => void;
}) {
  const { t } = useTranslation(["connections", "common"]);
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const closeSession = useSessionStore((state) => state.closeSession);
  const addSession = useSessionStore((state) => state.addSession);
  const { ref, isDragging, isDropTarget } = useSortable({
    id: session.id,
    index,
    group: SIDEBAR_SORTABLE_GROUP,
    transition: { idle: true },
  });

  const isActive = session.id === activeSessionId;
  const label = formatSidebarLabel(session);
  const shellBadge = getShellBadge(session);
  const otherTerminalCount = sessions.filter(
    (item) => item.kind === "terminal" && item.id !== session.id,
  ).length;

  const handleClose = () => {
    closeSession(session.id);
  };

  const handleCloseOthers = () => {
    setActiveSession(session.id);
    const otherIds = sessions
      .filter((item) => item.kind === "terminal" && item.id !== session.id)
      .map((item) => item.id);
    for (const id of otherIds) {
      closeSession(id);
    }
  };

  const handleDuplicate = () => {
    addSession({
      kind: session.kind,
      title: session.title,
      profileId: session.profileId,
      protocol: session.protocol,
      shellId: session.shellId,
      shellName: session.shellName,
      tabLabel: session.tabLabel,
      customTitle: session.customTitle,
      status: session.protocol === "ssh" ? "creating" : undefined,
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={ref}
            title={label}
            className={cn(
              "group/session-tab flex h-7 w-full cursor-grab items-center gap-1 rounded-md px-1 text-left text-[13px] transition-colors active:cursor-grabbing",
              isActive
                ? "bg-muted/80 text-foreground"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              isDragging && "opacity-50",
              isDropTarget && "bg-muted/30",
            )}
          >
            <button
              type="button"
              onClick={() => setActiveSession(session.id)}
              className="flex min-w-0 flex-1 items-center px-1 text-left"
            >
              <span className="truncate font-mono">{label}</span>
            </button>
            <div className="relative flex h-6 w-7 shrink-0 items-center justify-center">
              <span className="text-[11px] text-muted-foreground/80 transition-opacity group-hover/session-tab:opacity-0">
                {shellBadge}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("connections:contextMenu.close")}
                className="absolute inset-0 size-6 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted/30 hover:text-muted-foreground/75 group-hover/session-tab:opacity-100"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  handleClose();
                }}
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        }
      />
      <ContextMenuContent className="w-48">
        {onRename ? (
          <ContextMenuItem onClick={onRename}>
            <PencilIcon />
            {t("connections:contextMenu.rename")}
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onClick={handleDuplicate}>
          <CopyIcon />
          {t("connections:contextMenu.duplicate")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleClose}>
          <XIcon />
          {t("connections:contextMenu.close")}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleCloseOthers}
          disabled={otherTerminalCount === 0}
        >
          {t("connections:contextMenu.closeOthers")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

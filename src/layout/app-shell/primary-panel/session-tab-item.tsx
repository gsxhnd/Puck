import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/react/sortable";
import { CopyIcon, Loader2Icon, PencilIcon, RefreshCwIcon, XIcon } from "lucide-react";
import type { Session } from "@/types/connection";
import { useSessionStore } from "@/stores/session-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import { formatSidebarLabel, getShellBadge } from "@/lib/session-display";
import {
  canReconnectSession,
  requestSessionReconnect,
} from "@/lib/reconnect-session";
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
  const showSessionPanel = useShellUiStore((state) => state.showSessionPanel);
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
  const isConnecting =
    session.status === "creating" || session.status === "reconnecting";
  const showReconnect = canReconnectSession(session);
  const otherSessionCount = sessions.filter(
    (item) => item.kind === session.kind && item.id !== session.id,
  ).length;

  const handleClose = () => {
    closeSession(session.id);
  };

  const handleCloseOthers = () => {
    setActiveSession(session.id);
    const otherIds = sessions
      .filter((item) => item.kind === session.kind && item.id !== session.id)
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
      status:
        session.protocol === "ssh" || session.protocol === "sftp"
          ? "creating"
          : undefined,
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={ref}
            title={label}
            role="button"
            tabIndex={0}
            onClick={() => {
              showSessionPanel();
              setActiveSession(session.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                showSessionPanel();
                setActiveSession(session.id);
              }
            }}
            className={cn(
              "group/session-tab flex h-7 w-full cursor-grab items-center gap-1 rounded-md px-1 text-left text-[13px] transition-colors active:cursor-grabbing",
              isActive
                ? "bg-foreground/12 text-foreground dark:bg-foreground/22 dark:text-foreground"
                : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground dark:hover:bg-foreground/14 dark:hover:text-foreground",
              isDragging && "opacity-50",
              isDropTarget && "bg-foreground/10 dark:bg-foreground/18",
            )}
          >
            <span className="min-w-0 flex-1 truncate px-1 font-mono">
              {label}
            </span>
            <div className="relative flex h-6 w-7 shrink-0 items-center justify-center">
              {isConnecting ? (
                <Loader2Icon
                  className="size-3.5 animate-spin text-muted-foreground/80 transition-opacity group-hover/session-tab:opacity-0"
                  aria-label={t("common:status.connecting")}
                />
              ) : (
                <span className="text-[11px] text-muted-foreground/80 transition-opacity group-hover/session-tab:opacity-0">
                  {shellBadge}
                </span>
              )}
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
        {showReconnect ? (
          <ContextMenuItem onClick={() => requestSessionReconnect(session)}>
            <RefreshCwIcon />
            {t("connections:contextMenu.reconnect")}
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleClose}>
          <XIcon />
          {t("connections:contextMenu.close")}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleCloseOthers}
          disabled={otherSessionCount === 0}
        >
          {t("connections:contextMenu.closeOthers")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

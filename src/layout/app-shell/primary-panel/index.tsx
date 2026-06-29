import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DragDropProvider } from "@dnd-kit/react";
import type { DragEndEvent } from "@dnd-kit/dom";
import { ConnectionDialog } from "@/components/connections/connection-dialog";
import { useSessionStore } from "@/stores/session-store";
import { useSidebarLayoutStore } from "@/stores/sidebar-layout-store";
import { listShells } from "@/lib/tauri-terminal";
import { openConnectionsWindow } from "@/lib/open-connections-window";
import { formatSidebarLabel } from "@/lib/session-display";
import {
  type SessionSort,
  buildSidebarGroups,
  groupIdFromDropId,
  isGroupDropId,
} from "@/lib/sidebar-groups";
import type { ShellInfo } from "@/types/shell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PrimaryPanelHeader } from "@/layout/app-shell/primary-panel/primary-panel-header";
import { SessionGroup } from "@/layout/app-shell/primary-panel/session-group";
import { NameInputDialog } from "@/layout/app-shell/primary-panel/name-input-dialog";

/**
 * The left-hand sidebar listing terminal sessions grouped and sortable.
 *
 * 应用左侧主侧栏：展示并管理所有终端会话。负责把会话按内置/自定义分组
 * 组织成可展示的列表（`buildSidebarGroups`），支持拖拽排序与跨分组移动、
 * 排序方式切换、新建连接/分组/本地终端，以及分组与会话的重命名/删除。
 * 各 UI 片段已拆分到同目录的子组件，本文件只保留状态编排与事件处理。
 */
export function PrimaryPanel({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t } = useTranslation(["connections", "common", "terminal"]);
  const sessions = useSessionStore((state) => state.sessions);
  const addSession = useSessionStore((state) => state.addSession);
  const renameSession = useSessionStore((state) => state.renameSession);
  const customGroups = useSidebarLayoutStore((state) => state.customGroups);
  const sessionGroup = useSidebarLayoutStore((state) => state.sessionGroup);
  const groupOrder = useSidebarLayoutStore((state) => state.groupOrder);
  const sessionOrder = useSidebarLayoutStore((state) => state.sessionOrder);
  const createGroup = useSidebarLayoutStore((state) => state.createGroup);
  const renameGroup = useSidebarLayoutStore((state) => state.renameGroup);
  const deleteGroup = useSidebarLayoutStore((state) => state.deleteGroup);
  const reorderSessions = useSidebarLayoutStore(
    (state) => state.reorderSessions,
  );
  const moveSessionToGroup = useSidebarLayoutStore(
    (state) => state.moveSessionToGroup,
  );
  const pruneSessions = useSidebarLayoutStore((state) => state.pruneSessions);
  const [sort, setSort] = useState<SessionSort>("recent");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);

  const sidebarSessions = useMemo(
    () =>
      sessions.filter(
        (session) => session.kind === "terminal" || session.kind === "files",
      ),
    [sessions],
  );

  const displayGroups = useMemo(
    () =>
      buildSidebarGroups(
        sidebarSessions,
        customGroups,
        sessionGroup,
        groupOrder,
        sessionOrder,
        sort,
      ),
    [
      sidebarSessions,
      customGroups,
      sessionGroup,
      groupOrder,
      sessionOrder,
      sort,
    ],
  );

  useEffect(() => {
    void listShells()
      .then(setShells)
      .catch(() => setShells([]));
  }, []);

  // 清理已关闭会话在侧栏布局中残留的分组归属与排序信息。
  useEffect(() => {
    pruneSessions(sidebarSessions.map((session) => session.id));
  }, [pruneSessions, sidebarSessions]);

  const openCreateDialog = () => {
    setEditingProfileId(null);
    setDialogOpen(true);
  };

  const openDefaultTerminal = () => {
    addSession({
      kind: "terminal",
      title: "__local__",
      protocol: "local",
    });
  };

  const openShellTerminal = (shell: ShellInfo) => {
    addSession({
      kind: "terminal",
      title: shell.name,
      protocol: "local",
      shellId: shell.id,
      shellName: shell.kind,
    });
  };

  // 拖拽结束：落在分组落点上则移动会话到该分组，否则在序列内重排；
  // 任一操作都会把排序方式切换为 "custom" 以保留用户手动顺序。
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.canceled) return;

      const { source, target } = event.operation;
      if (!source || !target) return;

      const activeId = String(source.id);
      const targetId = String(target.id);
      if (activeId === targetId) return;

      if (isGroupDropId(targetId)) {
        moveSessionToGroup(
          sidebarSessions,
          sort,
          activeId,
          groupIdFromDropId(targetId),
        );
      } else {
        reorderSessions(sidebarSessions, sort, activeId, targetId);
      }
      setSort("custom");
    },
    [moveSessionToGroup, reorderSessions, sort, sidebarSessions],
  );

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // 计算每个分组首个会话的全局拖拽序号偏移，供 dnd-kit 跨分组排序使用。
  const groupOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let offset = 0;
    for (const group of displayGroups) {
      offsets.set(group.id, offset);
      offset += group.sessions.length;
    }
    return offsets;
  }, [displayGroups]);

  const renamingGroup = customGroups.find((group) => group.id === renameGroupId);
  const renamingSession = sessions.find((session) => session.id === renameSessionId);

  return (
    <div
      data-shell-panel="primary"
      className="flex h-full w-full flex-col overflow-hidden bg-shell-secondary"
    >
      <PrimaryPanelHeader
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        sort={sort}
        setSort={setSort}
        shells={shells}
        onCreateConnection={openCreateDialog}
        onCreateGroup={() => setCreateGroupOpen(true)}
        onOpenDefaultTerminal={openDefaultTerminal}
        onOpenShellTerminal={openShellTerminal}
        onOpenConnectionsWindow={() => void openConnectionsWindow()}
      />

      {!collapsed ? (
      <ScrollArea className="min-h-0 flex-1 px-2 py-1">
        <DragDropProvider onDragEnd={handleDragEnd}>
          {displayGroups.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
              {t("common:empty.noSessions")}
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {displayGroups.map((group) => (
                <SessionGroup
                  key={group.id}
                  group={group}
                  collapsed={collapsedGroups.has(group.id)}
                  onToggle={() => toggleGroup(group.id)}
                  onRename={
                    group.isCustom ? () => setRenameGroupId(group.id) : undefined
                  }
                  onDelete={
                    group.isCustom ? () => deleteGroup(group.id) : undefined
                  }
                  onRenameSession={setRenameSessionId}
                  sessionIndexOffset={groupOffsets.get(group.id) ?? 0}
                />
              ))}
            </div>
          )}
        </DragDropProvider>
      </ScrollArea>
      ) : null}

      <ConnectionDialog
        open={dialogOpen}
        profileId={editingProfileId}
        onOpenChange={setDialogOpen}
      />

      <NameInputDialog
        open={createGroupOpen}
        title={t("connections:sidebarGroups.new")}
        description={t("connections:sidebarGroups.newDescription")}
        confirmLabel={t("connections:sidebarGroups.create")}
        onOpenChange={setCreateGroupOpen}
        onConfirm={(name) => {
          createGroup(name);
          setSort("custom");
        }}
      />

      <NameInputDialog
        open={renameGroupId != null}
        title={t("connections:sidebarGroups.rename")}
        description={t("connections:sidebarGroups.renameDescription")}
        defaultValue={renamingGroup?.name}
        confirmLabel={t("common:actions.save")}
        onOpenChange={(open) => {
          if (!open) setRenameGroupId(null);
        }}
        onConfirm={(name) => {
          if (renameGroupId) renameGroup(renameGroupId, name);
          setRenameGroupId(null);
        }}
      />

      <NameInputDialog
        open={renameSessionId != null}
        title={t("connections:contextMenu.rename")}
        description={t("connections:contextMenu.renameDescription")}
        defaultValue={
          renamingSession ? formatSidebarLabel(renamingSession) : undefined
        }
        confirmLabel={t("common:actions.save")}
        onOpenChange={(open) => {
          if (!open) setRenameSessionId(null);
        }}
        onConfirm={(name) => {
          if (renameSessionId) renameSession(renameSessionId, name);
          setRenameSessionId(null);
        }}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import type { DragEndEvent } from "@dnd-kit/dom";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowUpDownIcon,
  ChevronRightIcon,
  CopyIcon,
  FolderPlusIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { ConnectionDialog } from "@/components/connections/connection-dialog";
import type { ConnectionProfile, Session } from "@/types/connection";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { useSidebarLayoutStore } from "@/stores/sidebar-layout-store";
import { listShells } from "@/lib/tauri-terminal";
import {
  formatSidebarLabel,
  getShellBadge,
  profileTabLabel,
} from "@/lib/session-display";
import {
  type SessionSort,
  type SidebarDisplayGroup,
  SIDEBAR_SORTABLE_GROUP,
  GROUP_DROP_PREFIX,
  buildSidebarGroups,
  groupIdFromDropId,
  isGroupDropId,
} from "@/lib/sidebar-groups";
import type { ShellInfo } from "@/types/shell";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { PanelHeader } from "@/layout/app-shell/panel-header";

function SortableSessionTabItem({
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
          <button
            type="button"
            ref={ref}
            title={label}
            onClick={() => setActiveSession(session.id)}
            className={cn(
              "flex h-7 w-full cursor-grab items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors active:cursor-grabbing",
              isActive
                ? "bg-muted/80 text-foreground"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              isDragging && "opacity-50",
              isDropTarget && "bg-muted/30",
            )}
          >
            <span className="min-w-0 flex-1 truncate font-mono">{label}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground/80">
              {shellBadge}
            </span>
          </button>
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

function SessionGroup({
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
          "size-3.5 shrink-0 transition-transform",
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

function GroupNameDialog({
  open,
  title,
  description,
  defaultValue,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  defaultValue?: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void;
}) {
  const { t } = useTranslation("common");
  const [name, setName] = useState(defaultValue ?? "");

  useEffect(() => {
    if (open) {
      setName(defaultValue ?? "");
    }
  }, [defaultValue, open]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Input
              id="sidebar-group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={title}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConnectionSidebar() {
  const { t } = useTranslation(["connections", "common", "terminal"]);
  const profiles = useConnectionStore((state) => state.profiles);
  const sessions = useSessionStore((state) => state.sessions);
  const openOrFocusSession = useSessionStore(
    (state) => state.openOrFocusSession,
  );
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

  const terminalSessions = useMemo(
    () => sessions.filter((session) => session.kind === "terminal"),
    [sessions],
  );

  const displayGroups = useMemo(
    () =>
      buildSidebarGroups(
        terminalSessions,
        customGroups,
        sessionGroup,
        groupOrder,
        sessionOrder,
        sort,
      ),
    [
      terminalSessions,
      customGroups,
      sessionGroup,
      groupOrder,
      sessionOrder,
      sort,
    ],
  );

  const terminalProfiles = useMemo(
    () =>
      profiles.filter(
        (profile) => profile.protocol === "local" || profile.protocol === "ssh",
      ),
    [profiles],
  );

  useEffect(() => {
    void listShells()
      .then(setShells)
      .catch(() => setShells([]));
  }, []);

  useEffect(() => {
    pruneSessions(terminalSessions.map((session) => session.id));
  }, [pruneSessions, terminalSessions]);

  const openCreateDialog = () => {
    setEditingProfileId(null);
    setDialogOpen(true);
  };

  const openConnection = (profile: ConnectionProfile) => {
    openOrFocusSession({
      kind: "terminal",
      title: profile.name,
      profileId: profile.id,
      protocol: profile.protocol,
      shellName: profile.protocol === "ssh" ? "ssh" : undefined,
      tabLabel: profileTabLabel(profile),
      status: profile.protocol === "ssh" ? "creating" : undefined,
    });
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
          terminalSessions,
          sort,
          activeId,
          groupIdFromDropId(targetId),
        );
      } else {
        reorderSessions(terminalSessions, sort, activeId, targetId);
      }
      setSort("custom");
    },
    [moveSessionToGroup, reorderSessions, sort, terminalSessions],
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
    <div className="flex h-full w-full flex-col bg-shell-primary">
      <PanelHeader macosInset trailing={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("connections:sidebarGroups.new")}
              onClick={() => setCreateGroupOpen(true)}
            >
              <FolderPlusIcon />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("connections:sort.label")}
                  >
                    <ArrowUpDownIcon />
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

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("common:actions.newConnection")}
                  >
                    <PlusIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={openCreateDialog}>
                  {t("common:actions.newConnection")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t("terminal:pickShell")}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={openDefaultTerminal}>
                    {t("terminal:localDefault")}
                  </DropdownMenuItem>
                  {shells.map((shell) => (
                    <DropdownMenuItem
                      key={shell.id}
                      onClick={() => openShellTerminal(shell)}
                    >
                      <span className="truncate">{shell.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground uppercase">
                        {shell.kind}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                {terminalProfiles.length > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        {t("connections:title")}
                      </DropdownMenuLabel>
                      {terminalProfiles.map((profile) => (
                        <DropdownMenuItem
                          key={profile.id}
                          onClick={() => openConnection(profile)}
                        >
                          {profile.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

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

      <ConnectionDialog
        open={dialogOpen}
        profileId={editingProfileId}
        onOpenChange={setDialogOpen}
      />

      <GroupNameDialog
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

      <GroupNameDialog
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

      <GroupNameDialog
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

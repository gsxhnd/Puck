import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpDownIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react";
import { ConnectionDialog } from "@/components/connections/connection-dialog";
import type { ConnectionProfile, Session } from "@/types/connection";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { listShells } from "@/lib/tauri-terminal";
import {
  formatSidebarLabel,
  getShellBadge,
  groupSessionsByDirectory,
  profileTabLabel,
} from "@/lib/session-display";
import type { ShellInfo } from "@/types/shell";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";

type SessionSort = "nameAsc" | "nameDesc" | "recent";

function sessionSortKey(session: Session): string {
  return session.tabLabel ?? session.title;
}

function sortSessions(sessions: Session[], sort: SessionSort): Session[] {
  const sorted = [...sessions];
  switch (sort) {
    case "nameDesc":
      return sorted.sort((a, b) =>
        sessionSortKey(b).localeCompare(sessionSortKey(a)),
      );
    case "recent":
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    default:
      return sorted.sort((a, b) =>
        sessionSortKey(a).localeCompare(sessionSortKey(b)),
      );
  }
}

function SessionTabItem({ session }: { session: Session }) {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

  const isActive = session.id === activeSessionId;
  const label = formatSidebarLabel(session);
  const shellBadge = getShellBadge(session);

  return (
    <button
      type="button"
      title={label}
      onClick={() => setActiveSession(session.id)}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors",
        isActive
          ? "bg-muted/80 text-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <span className="min-w-0 flex-1 truncate font-mono">{label}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground/80">
        {shellBadge}
      </span>
    </button>
  );
}

function SessionGroup({
  groupKey,
  sessions,
  collapsed,
  onToggle,
}: {
  groupKey: string;
  sessions: Session[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-0.5">
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
        <span className="truncate font-mono">{groupKey}</span>
      </button>
      {!collapsed ? (
        <div className="space-y-0.5 pl-1">
          {sessions.map((session) => (
            <SessionTabItem key={session.id} session={session} />
          ))}
        </div>
      ) : null}
    </div>
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
  const [sort, setSort] = useState<SessionSort>("recent");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const terminalSessions = useMemo(
    () => sessions.filter((session) => session.kind === "terminal"),
    [sessions],
  );

  const sortedSessions = useMemo(
    () => sortSessions(terminalSessions, sort),
    [terminalSessions, sort],
  );

  const groupedSessions = useMemo(
    () => groupSessionsByDirectory(sortedSessions),
    [sortedSessions],
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

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 px-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">
          {t("connections:tabsTitle")}
        </span>
        <div className="flex items-center gap-0.5">
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
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 py-1">
        {groupedSessions.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t("common:empty.noSessions")}
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {groupedSessions.map((group) => (
              <SessionGroup
                key={group.key}
                groupKey={group.key}
                sessions={group.sessions}
                collapsed={collapsedGroups.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <ConnectionDialog
        open={dialogOpen}
        profileId={editingProfileId}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

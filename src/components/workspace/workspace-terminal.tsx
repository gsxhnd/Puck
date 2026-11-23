/**
 * Workspace-owned terminal tabs and terminal workspace.
 *
 * 工作区终端区域：拥有独立的标签栏、新建/关闭/折叠操作，终端与编辑器标签
 * 不共享生命周期。所有终端通过 workspaceId 隔离。
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PanelBottomIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PanelTopIcon,
  PlusIcon,
  SquareTerminalIcon,
  XIcon,
} from "lucide-react";
import { createWorkspaceTerminal, toggleTerminalPanel } from "@/lib/workspace-actions";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { useShellLayoutStore, type TerminalSide } from "@/stores/shell-layout-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { TerminalWorkspace } from "@/page/terminal/terminal-workspace";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function terminalTitle(session: {
  customTitle?: string;
  shellName?: string;
  title: string;
  protocol?: string;
}): string {
  if (session.customTitle) return session.customTitle;
  if (session.title !== "__local__") return session.title;
  return session.shellName ?? "local";
}

const TERMINAL_SIDE_ITEMS: Array<{
  side: TerminalSide;
  icon: typeof PanelBottomIcon;
  labelKey: string;
}> = [
  { side: "bottom", icon: PanelBottomIcon, labelKey: "common:workspace.terminalSideBottom" },
  { side: "right", icon: PanelRightIcon, labelKey: "common:workspace.terminalSideRight" },
  { side: "top", icon: PanelTopIcon, labelKey: "common:workspace.terminalSideTop" },
  { side: "left", icon: PanelLeftIcon, labelKey: "common:workspace.terminalSideLeft" },
];

function TerminalSideIcon({ side }: { side: TerminalSide }) {
  const item =
    TERMINAL_SIDE_ITEMS.find((entry) => entry.side === side) ??
    TERMINAL_SIDE_ITEMS[0];
  const Icon = item?.icon ?? PanelBottomIcon;
  return <Icon />;
}

export function WorkspaceTerminal() {
  const { t } = useTranslation(["common", "terminal"]);
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const terminalOpen = useWorkspaceStore((state) => state.terminalOpen);
  const terminalSide = useShellLayoutStore((state) => state.terminalSide);
  const setTerminalSide = useShellLayoutStore((state) => state.setTerminalSide);
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const closeSession = useSessionStore((state) => state.closeSession);
  const workspaceSessions = sessions.filter(
    (session) =>
      session.kind === "terminal" &&
      (workspace ? session.workspaceId === workspace.id : !session.workspaceId),
  );
  const activeWorkspaceSession = workspaceSessions.some(
    (session) => session.id === activeSessionId,
  )
    ? activeSessionId
    : (workspaceSessions[0]?.id ?? null);

  useEffect(() => {
    if (activeWorkspaceSession && activeWorkspaceSession !== activeSessionId) {
      setActiveSession(activeWorkspaceSession);
    }
  }, [activeSessionId, activeWorkspaceSession, setActiveSession]);

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={t("common:workspace.terminal")}>
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {terminalOpen
            ? workspaceSessions.map((session) => {
                const active = session.id === activeWorkspaceSession;
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "group flex h-7 max-w-48 shrink-0 items-center gap-1 rounded-md px-2 text-xs",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left"
                      onClick={() => setActiveSession(session.id)}
                    >
                      {terminalTitle(session)}
                      {session.status === "creating" || session.status === "reconnecting" ? "…" : ""}
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 opacity-0 hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={t("common:actions.close")}
                      onClick={() => closeSession(session.id)}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                );
              })
            : null}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("common:actions.newTerminal")}
          title={t("common:actions.newTerminal")}
          onClick={() => void createWorkspaceTerminal()}
        >
          <PlusIcon />
        </Button>
        {terminalOpen ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("common:workspace.terminalSide")}
                  title={t("common:workspace.terminalSide")}
                >
                  <TerminalSideIcon side={terminalSide} />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuRadioGroup
                value={terminalSide}
                onValueChange={(value) => setTerminalSide(value as TerminalSide)}
              >
                {TERMINAL_SIDE_ITEMS.map((item) => (
                  <DropdownMenuRadioItem key={item.side} value={item.side}>
                    <item.icon />
                    {t(item.labelKey)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={terminalOpen ? t("common:workspace.hideTerminal") : t("common:workspace.showTerminal")}
          title={terminalOpen ? t("common:workspace.hideTerminal") : t("common:workspace.showTerminal")}
          onClick={toggleTerminalPanel}
        >
          {terminalOpen ? <ChevronDownIcon /> : <ChevronUpIcon />}
        </Button>
      </div>

      {terminalOpen ? (
        <div className="min-h-0 flex-1">
          {activeWorkspaceSession ? (
            <TerminalWorkspace
              activeSessionId={activeWorkspaceSession}
              workspaceId={workspace?.id ?? "__unscoped__"}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <SquareTerminalIcon className="size-6" />
              <Button variant="outline" size="sm" onClick={() => void createWorkspaceTerminal()}>
                <PlusIcon data-icon="inline-start" />
                {t("common:actions.newTerminal")}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

import { useTranslation } from "react-i18next";
import { PanelRightIcon } from "lucide-react";
import { PanelHeader } from "@/layout/app-shell/panel-header";
import { MAIN_SIDEBAR_TOOLBAR_SLOT_ID } from "@/layout/app-shell/sidebar-toolbar-slot";
import { useSessionStore } from "@/stores/session-store";
import { TerminalPane } from "@/page/terminal/terminal-pane";
import { SshTerminalPane } from "@/page/terminal/ssh-terminal-pane";
import { FileManager } from "@/page/files/file-manager";
import { NewTerminalMenu } from "@/page/terminal/new-terminal-menu";
import { TerminalPathBar } from "@/page/terminal/terminal-path-bar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MainWorkspaceProps = {
  leftSidebarOpen?: boolean;
  rightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
};

function EmptyWorkspace() {
  const { t } = useTranslation(["common", "terminal"]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("common:app.name")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("common:empty.noSessions")}
        </p>
      </div>
      <NewTerminalMenu />
    </div>
  );
}

function MainPanelHeader({
  leftSidebarOpen = true,
  rightSidebarOpen = true,
  onToggleRightSidebar,
}: MainWorkspaceProps) {
  const { t } = useTranslation("common");
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  return (
    <PanelHeader
      layout="balanced"
      macosInset={!leftSidebarOpen}
      leading={
        <div
          id={MAIN_SIDEBAR_TOOLBAR_SLOT_ID}
          className="flex min-h-7 items-center gap-0.5"
        />
      }
      center={
        activeSession?.kind === "terminal" ? (
          <TerminalPathBar session={activeSession} />
        ) : null
      }
      trailing={
        !rightSidebarOpen && onToggleRightSidebar ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    !rightSidebarOpen && "text-muted-foreground",
                  )}
                  aria-label={t("nav.toggleSecondaryPanel")}
                  onClick={onToggleRightSidebar}
                >
                  <PanelRightIcon />
                </Button>
              }
            />
            <TooltipContent side="bottom">
              {t("nav.toggleSecondaryPanel")}
            </TooltipContent>
          </Tooltip>
        ) : null
      }
    />
  );
}

export function MainWorkspace({
  leftSidebarOpen,
  rightSidebarOpen,
  onToggleRightSidebar,
}: MainWorkspaceProps) {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  const localTerminalSessions = sessions.filter(
    (session) =>
      session.kind === "terminal" &&
      (!session.protocol || session.protocol === "local"),
  );
  const sshTerminalSessions = sessions.filter(
    (session) => session.kind === "terminal" && session.protocol === "ssh",
  );
  const fileSessions = sessions.filter((session) => session.kind === "files");

  if (!activeSession) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-shell-main">
        <MainPanelHeader
          leftSidebarOpen={leftSidebarOpen}
          rightSidebarOpen={rightSidebarOpen}
          onToggleRightSidebar={onToggleRightSidebar}
        />
        <EmptyWorkspace />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-shell-main">
      <MainPanelHeader
        leftSidebarOpen={leftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        onToggleRightSidebar={onToggleRightSidebar}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {localTerminalSessions.map((session) => (
          <TerminalPane
            key={session.id}
            sessionId={session.id}
            shellId={session.shellId}
            active={session.id === activeSessionId}
          />
        ))}

        {sshTerminalSessions.map((session) => (
          <SshTerminalPane
            key={session.id}
            sessionId={session.id}
            profileId={session.profileId}
            active={session.id === activeSessionId}
          />
        ))}

        {fileSessions.map((session) => (
          <FileManager
            key={session.id}
            sessionId={session.id}
            profileId={session.profileId}
            active={session.id === activeSessionId}
          />
        ))}
      </div>
    </div>
  );
}

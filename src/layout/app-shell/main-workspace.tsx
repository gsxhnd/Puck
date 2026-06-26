import { useTranslation } from "react-i18next";
import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { PanelHeader } from "@/layout/app-shell/panel-header";
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
  onToggleLeftSidebar?: () => void;
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
  onToggleLeftSidebar,
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
        onToggleLeftSidebar ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    !leftSidebarOpen && "text-muted-foreground",
                  )}
                  aria-label={t("nav.togglePrimaryPanel")}
                  onClick={onToggleLeftSidebar}
                >
                  <PanelLeftIcon />
                </Button>
              }
            />
            <TooltipContent side="bottom">
              {t("nav.togglePrimaryPanel")}
            </TooltipContent>
          </Tooltip>
        ) : null
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
  onToggleLeftSidebar,
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
          onToggleLeftSidebar={onToggleLeftSidebar}
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
        onToggleLeftSidebar={onToggleLeftSidebar}
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

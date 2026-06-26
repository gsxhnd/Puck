import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/stores/session-store";
import { TerminalPane } from "@/page/terminal/terminal-pane";
import { SshTerminalPane } from "@/page/terminal/ssh-terminal-pane";
import { TerminalPathBar } from "@/page/terminal/terminal-path-bar";
import { FileManager } from "@/page/files/file-manager";
import { NewTerminalMenu } from "@/page/terminal/new-terminal-menu";

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

export function MainWorkspace() {
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
    return <EmptyWorkspace />;
  }

  const showPathBar = activeSession.kind === "terminal";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {showPathBar ? <TerminalPathBar session={activeSession} /> : null}
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

import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/stores/session-store";
import { SettingsPage } from "@/components/settings/settings-page";
import { TerminalPane } from "@/components/terminal/terminal-pane";
import { SshTerminalPane } from "@/components/terminal/ssh-terminal-pane";
import { FileManager } from "@/components/files/file-manager";
import { NewTerminalMenu } from "@/components/terminal/new-terminal-menu";

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

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
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

      {activeSession.kind === "settings" ? (
        <div className="absolute inset-0 min-h-0 overflow-hidden">
          <SettingsPage />
        </div>
      ) : null}
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/stores/session-store";
import { isLocalTerminalSession } from "@/lib/use-active-local-session";
import { LocalFileExplorerPanel } from "@/components/workspace/local-file-explorer";
import { RemoteFileExplorerPanel } from "@/components/workspace/remote-file-explorer";

function isSshTerminalSession(session: {
  kind: string;
  protocol?: string;
} | null): boolean {
  return session?.kind === "terminal" && session.protocol === "ssh";
}

export function FileExplorerPanel() {
  const { t } = useTranslation("info");
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  if (!activeSession || activeSession.kind !== "terminal") {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        {t("noActiveTerminal")}
      </div>
    );
  }

  if (isLocalTerminalSession(activeSession)) {
    return <LocalFileExplorerPanel activeSession={activeSession} />;
  }

  if (isSshTerminalSession(activeSession)) {
    return <RemoteFileExplorerPanel activeSession={activeSession} />;
  }

  return (
    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
      {t("filesRemoteUnsupported")}
    </div>
  );
}

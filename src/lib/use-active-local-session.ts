import { useSessionStore } from "@/stores/session-store";
import { getSessionPathDisplay } from "@/lib/session-display";
import type { Session } from "@/types/connection";

export function isLocalTerminalSession(session: Session | null): boolean {
  if (!session || session.kind !== "terminal") {
    return false;
  }
  return !session.protocol || session.protocol === "local";
}

export function getWorkspacePath(session: Session | null): string {
  if (!session) {
    return "~";
  }
  return getSessionPathDisplay(session);
}

export function useActiveLocalSession() {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  return {
    activeSession,
    isLocal: isLocalTerminalSession(activeSession),
    workspacePath: getWorkspacePath(activeSession),
  };
}

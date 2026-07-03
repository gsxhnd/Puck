import type { Session } from "@/types/connection";
import { useSessionStore } from "@/stores/session-store";

export const RECONNECT_SESSION_EVENT = "puck:reconnect-session";

export function isRemoteSession(session: Session): boolean {
  return session.protocol === "ssh" || session.protocol === "sftp";
}

export function canReconnectSession(session: Session): boolean {
  if (!isRemoteSession(session)) {
    return false;
  }
  return session.status !== "creating" && session.status !== "reconnecting";
}

export function requestSessionReconnect(session: Session) {
  if (!canReconnectSession(session)) {
    return;
  }

  useSessionStore.getState().setActiveSession(session.id);
  window.dispatchEvent(
    new CustomEvent(RECONNECT_SESSION_EVENT, {
      detail: { sessionId: session.id },
    }),
  );
}

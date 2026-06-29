import type { ConnectionProfile } from "@/types/connection";
import type { Session } from "@/types/connection";
import { buildProfileSessionRequest } from "@/lib/open-connection-profile";
import { prepareProfileConnection } from "@/lib/resolve-connection-credential";
import { requestSessionReconnect } from "@/lib/reconnect-session";
import { useSessionStore } from "@/stores/session-store";
import { useShellUiStore } from "@/stores/shell-ui-store";

/** Opens or focuses a saved profile session and switches to the sessions tab. */
export async function openProfileSession(
  profile: ConnectionProfile,
): Promise<Session | null> {
  const request = buildProfileSessionRequest(profile);
  const sessionState = useSessionStore.getState();

  useShellUiStore.getState().showSessionPanel();

  if (request.profileId) {
    const existing = sessionState.sessions.find(
      (session) =>
        session.profileId === request.profileId &&
        session.kind === request.kind,
    );

    if (existing) {
      sessionState.setActiveSession(existing.id);

      if (
        existing.status === "connected" ||
        existing.status === "creating" ||
        existing.status === "reconnecting"
      ) {
        return existing;
      }

      const ready = await prepareProfileConnection(profile);
      if (!ready) {
        return null;
      }

      requestSessionReconnect(existing);
      return existing;
    }
  }

  const ready = await prepareProfileConnection(profile);
  if (!ready) {
    return null;
  }

  return sessionState.addSession(request);
}

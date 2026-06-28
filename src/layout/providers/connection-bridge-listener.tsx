import { useEffect } from "react";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { getAppWindowMode } from "@/lib/app-window";
import { subscribeConnectionOpenRequests } from "@/lib/connection-bridge";
import { buildProfileSessionRequest } from "@/lib/open-connection-profile";

/** Opens a saved profile in the main window when requested from the connections window. */
export function ConnectionBridgeListener() {
  const openOrFocusSession = useSessionStore(
    (state) => state.openOrFocusSession,
  );

  useEffect(() => {
    if (getAppWindowMode() !== "main") return;

    return subscribeConnectionOpenRequests((profileId) => {
      const profile = useConnectionStore.getState().getProfile(profileId);
      if (!profile) return;
      openOrFocusSession(buildProfileSessionRequest(profile));
    });
  }, [openOrFocusSession]);

  return null;
}

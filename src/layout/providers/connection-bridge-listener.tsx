import { useEffect } from "react";
import { useConnectionStore } from "@/stores/connection-store";
import { getAppWindowMode } from "@/lib/app-window";
import { subscribeConnectionOpenRequests } from "@/lib/connection-bridge";
import { openProfileSession } from "@/lib/open-profile-session";

/** Opens a saved profile in the main window when requested from the connections window. */
export function ConnectionBridgeListener() {
  useEffect(() => {
    if (getAppWindowMode() !== "main") return;

    return subscribeConnectionOpenRequests((profileId) => {
      const profile = useConnectionStore.getState().getProfile(profileId);
      if (!profile) return;
      void openProfileSession(profile);
    });
  }, []);

  return null;
}

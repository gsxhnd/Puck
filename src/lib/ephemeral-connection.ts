import { useConnectionStore } from "@/stores/connection-store";
import type { Session } from "@/types/connection";
import { deleteConnectionCredentials } from "@/lib/tauri-ssh";

/** Remove a quick-connect profile when no open session references it. */
export async function cleanupEphemeralProfileIfUnused(
  profileId: string,
  sessions: Session[],
): Promise<void> {
  const profile = useConnectionStore.getState().getProfile(profileId);
  if (!profile?.ephemeral) return;

  const stillUsed = sessions.some((session) => session.profileId === profileId);
  if (stillUsed) return;

  await deleteConnectionCredentials(profileId);
  useConnectionStore.getState().removeProfile(profileId);
}

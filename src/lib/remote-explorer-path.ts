import type { ConnectionProfile, Session } from "@/types/connection";

/** Resolves the remote directory to list, preferring the terminal OSC7 cwd. */
export function getRemoteExplorerCwd(
  session: Session,
  profile?: ConnectionProfile,
): string {
  const cwd = session.cwd?.trim();
  if (cwd && cwd.startsWith("/")) {
    return cwd;
  }

  const defaultDir = profile?.defaultDirectory?.trim();
  if (defaultDir) {
    return defaultDir;
  }

  return "/";
}

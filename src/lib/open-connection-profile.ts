import type { ConnectionProfile } from "@/types/connection";
import { profileTabLabel } from "@/lib/session-display";

export function buildProfileSessionRequest(profile: ConnectionProfile) {
  if (
    profile.protocol === "sftp" ||
    profile.protocol === "ftp" ||
    profile.protocol === "ftps"
  ) {
    return {
      kind: "files" as const,
      title: profile.name,
      profileId: profile.id,
      protocol: profile.protocol,
    };
  }

  return {
    kind: "terminal" as const,
    title: profile.name,
    profileId: profile.id,
    protocol: profile.protocol,
    shellName: profile.protocol === "ssh" ? "ssh" : undefined,
    tabLabel: profileTabLabel(profile),
    status: profile.protocol === "ssh" ? ("creating" as const) : undefined,
  };
}

import type { ConnectionProfile } from "@/types/connection";
import { profileTabLabel } from "@/lib/session-display";

export function buildProfileSessionRequest(profile: ConnectionProfile) {
  if (profile.protocol === "sftp") {
    return {
      kind: "files" as const,
      title: profile.name,
      profileId: profile.id,
      protocol: profile.protocol,
      tabLabel: profileTabLabel(profile),
      status: "creating" as const,
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

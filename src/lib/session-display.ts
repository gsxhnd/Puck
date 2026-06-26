import type { ConnectionProfile, Session } from "@/types/connection";

const OSC7_REGEX =
  /\x1b\]7;file:\/\/(?:([^/\x07\x1b\\]+))?(\/[^\x07\x1b\\]*)?[\x07\x1b\\]/g;

export function extractOsc7Cwd(
  data: string,
): { hostname: string; cwd: string } | null {
  let last: { hostname: string; cwd: string } | null = null;

  for (const match of data.matchAll(OSC7_REGEX)) {
    const hostname = match[1] || "localhost";
    const rawPath = match[2] || "/";
    try {
      last = { hostname, cwd: decodeURIComponent(rawPath) };
    } catch {
      last = { hostname, cwd: rawPath };
    }
  }

  return last;
}

export function shortenPath(path: string): string {
  const homeMatch = path.match(/^\/(?:Users|home)\/[^/]+(\/.*)?$/);
  if (homeMatch) {
    return `~${homeMatch[1] || ""}`;
  }
  return path;
}

export function buildTabLabel(
  username: string,
  hostname: string,
  cwd: string,
): string {
  return `${username}@${hostname}:${shortenPath(cwd)}`;
}

export function profileTabLabel(profile: ConnectionProfile): string {
  if (profile.protocol === "local") {
    return "local:~";
  }
  const user = profile.username || "user";
  const host = profile.host || "host";
  return `${user}@${host}:~`;
}

export function formatSidebarLabel(
  session: Session,
  profile: ConnectionProfile | undefined,
  isActive: boolean,
): string {
  const base =
    session.tabLabel ??
    (profile ? profileTabLabel(profile) : undefined) ??
    resolveFallbackTitle(session.title);

  if (!isActive && profile?.name && profile.protocol !== "local") {
    return `${profile.name} ${base}`;
  }

  return base;
}

export function getShellBadge(session: Session): string {
  return session.shellName ?? "sh";
}

function resolveFallbackTitle(title: string): string {
  if (
    title === "__local__" ||
    title === "Local Terminal" ||
    title === "本地终端"
  ) {
    return "local:~";
  }
  return title;
}

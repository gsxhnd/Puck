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

export function getSessionCwd(session: Session): string {
  if (session.cwd) {
    return shortenPath(session.cwd);
  }

  const label = session.tabLabel;
  if (label?.includes(":")) {
    const pathPart = label.split(":").slice(1).join(":");
    if (pathPart) {
      return pathPart;
    }
  }

  return "~";
}

export function getSessionPathDisplay(session: Session): string {
  if (session.cwd) {
    return session.cwd;
  }

  const label = session.tabLabel;
  if (label?.includes(":")) {
    const pathPart = label.split(":").slice(1).join(":");
    if (pathPart.startsWith("~")) {
      return pathPart;
    }
    if (pathPart) {
      return pathPart;
    }
  }

  return "~";
}

export function getSessionGroupKey(session: Session): string {
  const cwd = getSessionCwd(session);
  if (cwd === "~") {
    return "~";
  }

  const lastSlash = cwd.lastIndexOf("/");
  if (lastSlash <= 0) {
    return cwd;
  }

  return cwd.slice(0, lastSlash) || "~";
}

export function formatSidebarLabel(session: Session): string {
  if (session.customTitle) {
    return session.customTitle;
  }
  return session.tabLabel ?? resolveFallbackTitle(session.title);
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

export function groupSessionsByDirectory(
  sessions: Session[],
): Array<{ key: string; sessions: Session[] }> {
  const groups = new Map<string, Session[]>();

  for (const session of sessions) {
    const key = getSessionGroupKey(session);
    const list = groups.get(key) ?? [];
    list.push(session);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, groupedSessions]) => ({
      key,
      sessions: groupedSessions,
    }));
}

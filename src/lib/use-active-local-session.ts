import { useSessionStore } from "@/stores/session-store";
import { getSessionPathDisplay } from "@/lib/session-display";
import type { Session } from "@/types/connection";

export function isLocalTerminalSession(session: Session | null): boolean {
  if (!session || session.kind !== "terminal") {
    return false;
  }
  return !session.protocol || session.protocol === "local";
}

export function getWorkspacePath(session: Session | null): string {
  if (!session) {
    return "~";
  }
  return getSessionPathDisplay(session);
}

export function useActiveLocalSession() {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  return {
    activeSession,
    isLocal: isLocalTerminalSession(activeSession),
    workspacePath: getWorkspacePath(activeSession),
  };
}

/**
 * Default cwd for newly created local terminals: the active local terminal's
 * working directory, or undefined (home) when unavailable.
 *
 * 新建本地终端的默认 cwd：取当前活动本地终端的工作目录；不可用时返回
 * undefined（后端回退 home 目录）。
 */
export function activeWorkspaceCwd(): string | undefined {
  const { sessions, activeSessionId } = useSessionStore.getState();
  const active =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  return isLocalTerminalSession(active) ? getWorkspacePath(active) : undefined;
}

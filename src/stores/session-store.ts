/**
 * In-memory store for open session tabs (terminals and file panes).
 *
 * 当前打开的所有会话标签（终端、文件管理器等）的运行时 store。负责新增、
 * 聚焦、关闭、重命名会话以及更新连接状态与工作目录。会话生命周期与应用、
 * Workspace 生命周期相互独立，不持久化——会话列表随应用重启清空。
 */
import { create } from "zustand";
import { cleanupEphemeralProfileIfUnused } from "@/lib/ephemeral-connection";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  type ConnectionProtocol,
  type Session,
  type SessionKind,
  type SessionStatus,
  type SessionTitleMode,
} from "@/types/connection";

type SessionStore = {
  sessions: Session[];
  activeSessionId: string | null;
  addSession: (partial: {
    kind: SessionKind;
    title: string;
    profileId?: string;
    protocol?: ConnectionProtocol;
    shellId?: string;
    shellName?: string;
    tabLabel?: string;
    customTitle?: string;
    titleMode?: SessionTitleMode;
    titlePrefix?: string;
    cwd?: string;
    workspaceId?: string;
    status?: SessionStatus;
  }) => Session;
  openOrFocusSession: (partial: {
    kind: SessionKind;
    title: string;
    profileId?: string;
    protocol?: ConnectionProtocol;
    shellId?: string;
    shellName?: string;
    tabLabel?: string;
    customTitle?: string;
    titleMode?: SessionTitleMode;
    titlePrefix?: string;
    cwd?: string;
    workspaceId?: string;
    status?: SessionStatus;
  }) => Session;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  resetSessionTitle: (id: string) => void;
  updateSessionTitle: (
    id: string,
    update: {
      customTitle?: string;
      titlePrefix?: string;
      titleMode?: SessionTitleMode;
    },
  ) => void;
  updateSessionStatus: (id: string, status: SessionStatus) => void;
  updateSessionMeta: (
    id: string,
    meta: { shellName?: string; tabLabel?: string; cwd?: string },
  ) => void;
  reorderTerminalSessions: (
    activeId: string,
    overId: string,
    visualOrder: string[],
  ) => void;
};

function createSession(
  partial: Parameters<SessionStore["addSession"]>[0],
): Session {
  return {
    id: crypto.randomUUID(),
    kind: partial.kind,
    title: partial.title,
    profileId: partial.profileId,
    protocol: partial.protocol,
    shellId: partial.shellId,
    shellName: partial.shellName,
    tabLabel: partial.tabLabel,
    customTitle: partial.customTitle,
    titleMode: partial.titleMode,
    titlePrefix: partial.titlePrefix,
    cwd: partial.cwd,
    workspaceId: partial.workspaceId,
    status: partial.status ?? "connected",
    createdAt: new Date().toISOString(),
  };
}

function sameTerminalScope(session: Session, workspaceId?: string): boolean {
  return workspaceId ? session.workspaceId === workspaceId : !session.workspaceId;
}

/**
 * Collapses the terminal panel once the active workspace has no terminals left.
 *
 * 当前 Workspace 的最后一个终端被关闭（手动或进程退出）时自动收起终端面板，
 * 避免留下一个空的终端区域。
 */
function collapseTerminalPanelIfEmpty(
  closed: Session,
  remaining: Session[],
): void {
  if (closed.kind !== "terminal") return;
  const workspaceState = useWorkspaceStore.getState();
  if (!workspaceState.terminalOpen) return;
  const active = workspaceState.activeWorkspace;
  // Only react to the workspace the user is looking at; a background
  // workspace losing its last terminal must not hide another workspace's
  // terminals.
  // 只响应当前正在查看的 Workspace；后台 Workspace 的终端退出不应隐藏其他
  // Workspace 的终端。
  const scopeMatches = closed.workspaceId
    ? closed.workspaceId === active?.id
    : !active;
  if (!scopeMatches) return;
  const hasRemainingTerminal = remaining.some(
    (session) =>
      session.kind === "terminal" &&
      sameTerminalScope(session, closed.workspaceId),
  );
  if (!hasRemainingTerminal) {
    workspaceState.setTerminalOpen(false);
  }
}

export const useSessionStore = create<SessionStore>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  addSession: (partial) => {
    const session = createSession(partial);
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
    return session;
  },
  openOrFocusSession: (partial) => {
    const state = get();
    if (partial.profileId) {
      const existing = state.sessions.find(
        (session) =>
          session.profileId === partial.profileId &&
          session.kind === partial.kind,
      );
      if (existing) {
        set({ activeSessionId: existing.id });
        return existing;
      }
    }
    return get().addSession(partial);
  },
  closeSession: (id) => {
    let closedSession: Session | undefined;
    let remainingSessions: Session[] = [];
    set((state) => {
      closedSession = state.sessions.find((session) => session.id === id);
      const sessions = state.sessions.filter((session) => session.id !== id);
      remainingSessions = sessions;
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[sessions.length - 1]?.id ?? null)
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
    if (closedSession) {
      collapseTerminalPanelIfEmpty(closedSession, remainingSessions);
    }
    if (closedSession?.profileId) {
      void cleanupEphemeralProfileIfUnused(
        closedSession.profileId,
        remainingSessions,
      );
    }
  },
  setActiveSession: (id) => {
    if (get().sessions.some((session) => session.id === id)) {
      set({ activeSessionId: id });
    }
  },
  renameSession: (id, title) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id
          ? { ...session, customTitle: title, titleMode: "name" as const }
          : session,
      ),
    }));
  },
  resetSessionTitle: (id) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id
          ? {
              ...session,
              customTitle: undefined,
              titlePrefix: undefined,
              titleMode: undefined,
            }
          : session,
      ),
    }));
  },
  updateSessionTitle: (id, update) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, ...update } : session,
      ),
    }));
  },
  updateSessionStatus: (id, status) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, status } : session,
      ),
    }));
  },
  updateSessionMeta: (id, meta) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, ...meta } : session,
      ),
    }));
  },
  reorderTerminalSessions: (activeId, overId, visualOrder) => {
    set((state) => {
      const orderedIds = [...visualOrder];
      const oldIndex = orderedIds.indexOf(activeId);
      const newIndex = orderedIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return state;
      }

      const [removed] = orderedIds.splice(oldIndex, 1);
      if (!removed) {
        return state;
      }
      orderedIds.splice(newIndex, 0, removed);

      const terminalById = new Map(
        state.sessions
          .filter((session) => session.kind === "terminal")
          .map((session) => [session.id, session]),
      );
      const reorderedTerminals = orderedIds
        .map((id) => terminalById.get(id))
        .filter((session): session is Session => session != null);

      for (const session of terminalById.values()) {
        if (!orderedIds.includes(session.id)) {
          reorderedTerminals.push(session);
        }
      }

      const nonTerminal = state.sessions.filter(
        (session) => session.kind !== "terminal",
      );
      return { sessions: [...nonTerminal, ...reorderedTerminals] };
    });
  },
}));

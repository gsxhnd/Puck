import { create } from "zustand";
import {
  type ConnectionProtocol,
  type Session,
  type SessionKind,
  type SessionStatus,
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
    cwd?: string;
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
    cwd?: string;
    status?: SessionStatus;
  }) => Session;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  updateSessionStatus: (id: string, status: SessionStatus) => void;
  updateSessionMeta: (
    id: string,
    meta: { shellName?: string; tabLabel?: string; cwd?: string },
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
    cwd: partial.cwd,
    status: partial.status ?? "connected",
    createdAt: new Date().toISOString(),
  };
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
    set((state) => {
      const sessions = state.sessions.filter((session) => session.id !== id);
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[sessions.length - 1]?.id ?? null)
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
  },
  setActiveSession: (id) => {
    if (get().sessions.some((session) => session.id === id)) {
      set({ activeSessionId: id });
    }
  },
  renameSession: (id, title) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, title } : session,
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
}));

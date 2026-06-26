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
    status?: SessionStatus;
  }) => Session;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  updateSessionStatus: (id: string, status: SessionStatus) => void;
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
}));

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { puckPersistStorage, PUCK_CONFIG_KEYS } from "@/lib/puck-config-storage";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import {
  DEFAULT_SESSION_PRIVILEGES,
  type SessionPrivilegeKey,
  type SessionPrivileges,
} from "@/types/session-privileges";

type SessionPrivilegesState = {
  bySessionId: Record<string, SessionPrivileges>;
  getPrivileges: (sessionId: string) => SessionPrivileges;
  setPrivilege: (
    sessionId: string,
    key: SessionPrivilegeKey,
    value: boolean,
  ) => void;
  togglePrivilege: (sessionId: string, key: SessionPrivilegeKey) => void;
  pruneSessions: (activeSessionIds: string[]) => void;
};

function mergePrivileges(
  sessionId: string,
  current: Record<string, SessionPrivileges>,
): SessionPrivileges {
  const defaults = useAppSettingsStore.getState().defaultSessionPrivileges;
  return {
    ...DEFAULT_SESSION_PRIVILEGES,
    ...defaults,
    ...current[sessionId],
  };
}

export const useSessionPrivilegesStore = create<SessionPrivilegesState>()(
  persist(
    (set, get) => ({
      bySessionId: {},
      getPrivileges: (sessionId) =>
        mergePrivileges(sessionId, get().bySessionId),
      setPrivilege: (sessionId, key, value) => {
        set((state) => ({
          bySessionId: {
            ...state.bySessionId,
            [sessionId]: {
              ...mergePrivileges(sessionId, state.bySessionId),
              [key]: value,
            },
          },
        }));
      },
      togglePrivilege: (sessionId, key) => {
        const current = get().getPrivileges(sessionId);
        get().setPrivilege(sessionId, key, !current[key]);
      },
      pruneSessions: (activeSessionIds) => {
        const active = new Set(activeSessionIds);
        set((state) => {
          const next: Record<string, SessionPrivileges> = {};
          for (const [sessionId, privileges] of Object.entries(
            state.bySessionId,
          )) {
            if (active.has(sessionId)) {
              next[sessionId] = privileges;
            }
          }
          return { bySessionId: next };
        });
      },
    }),
    {
      name: PUCK_CONFIG_KEYS.sessionPrivileges,
      storage: puckPersistStorage,
      partialize: (state) => ({ bySessionId: state.bySessionId }),
    },
  ),
);

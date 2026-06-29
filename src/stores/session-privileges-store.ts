/**
 * Per-session privilege flags (e.g. paste, command tracking) with defaults.
 *
 * 按会话维度保存的权限开关（如粘贴、命令记录等）。读取时按
 * 「内置默认 → 用户全局默认 → 该会话覆盖」三层合并，因此只需持久化会话级
 * 的差异部分；`pruneSessions` 负责移除已关闭会话的权限残留。
 */
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

// 合并三层权限来源得到某会话的最终权限：内置默认 < 用户全局默认 < 会话覆盖。
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
      skipHydration: true,
      partialize: (state) => ({ bySessionId: state.bySessionId }),
    },
  ),
);

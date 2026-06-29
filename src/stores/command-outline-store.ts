/**
 * Per-session command history for the outline panel.
 *
 * 按会话记录已执行命令的 store，供次面板的「命令大纲」视图展示与跳转。
 * 每个会话最多保留 500 条记录，会话关闭时通过 removeSession 清理。
 */
import { create } from "zustand";

const MAX_ENTRIES_PER_SESSION = 500;

export type CommandOutlineEntry = {
  id: string;
  command: string;
  bufferLine: number;
  createdAt: number;
};

export const EMPTY_COMMAND_ENTRIES: CommandOutlineEntry[] = [];

type CommandOutlineStore = {
  entriesBySession: Record<string, CommandOutlineEntry[]>;
  activeEntryId: string | null;
  addEntry: (
    sessionId: string,
    entry: Omit<CommandOutlineEntry, "id">,
  ) => void;
  removeSession: (sessionId: string) => void;
  setActiveEntry: (entryId: string | null) => void;
};

export const useCommandOutlineStore = create<CommandOutlineStore>()((set) => ({
  entriesBySession: {},
  activeEntryId: null,
  addEntry: (sessionId, entry) => {
    set((state) => {
      const current = state.entriesBySession[sessionId] ?? [];
      const nextEntry: CommandOutlineEntry = {
        ...entry,
        id: crypto.randomUUID(),
      };
      const next = [...current, nextEntry].slice(-MAX_ENTRIES_PER_SESSION);

      return {
        entriesBySession: {
          ...state.entriesBySession,
          [sessionId]: next,
        },
      };
    });
  },
  removeSession: (sessionId) => {
    set((state) => {
      if (!state.entriesBySession[sessionId]) {
        return state;
      }

      const nextEntries = { ...state.entriesBySession };
      delete nextEntries[sessionId];

      return {
        entriesBySession: nextEntries,
        activeEntryId:
          state.activeEntryId &&
          state.entriesBySession[sessionId]?.some(
            (entry) => entry.id === state.activeEntryId,
          )
            ? null
            : state.activeEntryId,
      };
    });
  },
  setActiveEntry: (entryId) => {
    set({ activeEntryId: entryId });
  },
}));

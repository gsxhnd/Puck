/**
 * Persistent resizable panel layout for the main app shell.
 *
 * 主窗口三栏布局宽度的持久化 store，保存 react-resizable-panels 的 layout 对象。
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  puckConfigStorage,
  PUCK_CONFIG_KEYS,
  readPuckConfigValue,
} from "@/lib/puck-config-storage";

export type ShellLayout = Record<string, number>;

function migrateStoredLayout(layout: ShellLayout): ShellLayout {
  const { left, right, primary, second, main, ...rest } = layout;
  const migrated: ShellLayout = { ...rest };
  const resolvedPrimary = primary ?? left;
  const resolvedSecond = second ?? right;
  if (resolvedPrimary !== undefined) migrated.primary = resolvedPrimary;
  if (resolvedSecond !== undefined) migrated.second = resolvedSecond;
  if (main !== undefined) migrated.main = main;
  return migrated;
}

type ShellLayoutStore = {
  layout: ShellLayout | null;
  setLayout: (layout: ShellLayout) => void;
  getDefaultLayout: () => ShellLayout;
};

const DEFAULT_LAYOUT: ShellLayout = { primary: 20, main: 55, second: 25 };

const shellLayoutStorage = createJSONStorage(() => ({
  getItem: (name) => {
    const raw = readPuckConfigValue(name);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.state && typeof parsed.state === "object") {
        return raw;
      }
      return JSON.stringify({
        state: { layout: migrateStoredLayout(parsed as ShellLayout) },
        version: 0,
      });
    } catch {
      return null;
    }
  },
  setItem: (name, value) => puckConfigStorage.setItem(name, value),
  removeItem: (name) => puckConfigStorage.removeItem(name),
}));

export const useShellLayoutStore = create<ShellLayoutStore>()(
  persist(
    (set, get) => ({
      layout: null,

      setLayout: (layout) => set({ layout: migrateStoredLayout(layout) }),

      getDefaultLayout: () => get().layout ?? DEFAULT_LAYOUT,
    }),
    {
      name: PUCK_CONFIG_KEYS.shellLayout,
      storage: shellLayoutStorage,
      skipHydration: true,
      partialize: (state) => ({ layout: state.layout }),
      merge: (persisted, current) => {
        const state = persisted as Partial<ShellLayoutStore> | undefined;
        if (!state?.layout) return current;
        return {
          ...current,
          layout: migrateStoredLayout(state.layout),
        };
      },
    },
  ),
);

export { migrateStoredLayout, DEFAULT_LAYOUT };

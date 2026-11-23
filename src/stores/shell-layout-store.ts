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

/** Where the terminal island docks relative to the editor. 终端岛的停靠方位。 */
export type TerminalSide = "bottom" | "left" | "right" | "top";

export const DEFAULT_TERMINAL_SIDE: TerminalSide = "bottom";

function migrateStoredTerminalSide(value: unknown): TerminalSide {
  return value === "left" || value === "right" || value === "top"
    ? value
    : DEFAULT_TERMINAL_SIDE;
}

function migrateStoredLayout(layout: ShellLayout): ShellLayout {
  const { left, right, primary, second, main, ...rest } = layout;
  const migrated: ShellLayout = { ...rest };
  const resolvedPrimary = primary ?? left;
  const resolvedSecond = second ?? right;
  if (resolvedPrimary !== undefined) migrated.primary = resolvedPrimary;
  if (resolvedSecond !== undefined) migrated.second = resolvedSecond;
  if (main !== undefined) migrated.main = main;
  // The legacy three-pane layout stored only primary/main/second. The new
  // vertical editor/terminal group must never receive those stale values.
  // 旧三栏布局只保存 primary/main/second；新的上下编辑器/终端分组不能复用。
  if (migrated.editor === undefined) migrated.editor = DEFAULT_EDITOR;
  if (migrated.terminal === undefined) migrated.terminal = DEFAULT_TERMINAL;
  return migrated;
}

type ShellLayoutStore = {
  layout: ShellLayout | null;
  terminalSide: TerminalSide;
  setLayout: (layout: ShellLayout) => void;
  setTerminalSide: (side: TerminalSide) => void;
  getHorizontalLayout: () => ShellLayout;
  getVerticalLayout: () => ShellLayout;
};

const DEFAULT_PRIMARY = 22;
const DEFAULT_MAIN = 78;
const DEFAULT_EDITOR = 68;
const DEFAULT_TERMINAL = 32;

const DEFAULT_LAYOUT: ShellLayout = {
  primary: DEFAULT_PRIMARY,
  main: DEFAULT_MAIN,
  editor: DEFAULT_EDITOR,
  terminal: DEFAULT_TERMINAL,
};

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
      terminalSide: DEFAULT_TERMINAL_SIDE,

      setLayout: (layout) =>
        set((state) => ({
          layout: { ...state.layout, ...migrateStoredLayout(layout) },
        })),

      setTerminalSide: (terminalSide) => set({ terminalSide }),

      getHorizontalLayout: () => {
        const layout = get().layout ?? DEFAULT_LAYOUT;
        const primary = layout.primary;
        const main = layout.main;
        return {
          primary: typeof primary === "number" ? primary : DEFAULT_PRIMARY,
          main: typeof main === "number" ? main : DEFAULT_MAIN,
        };
      },

      getVerticalLayout: () => {
        const layout = get().layout ?? DEFAULT_LAYOUT;
        const editor = layout.editor;
        const terminal = layout.terminal;
        return {
          editor: typeof editor === "number" ? editor : DEFAULT_EDITOR,
          terminal: typeof terminal === "number" ? terminal : DEFAULT_TERMINAL,
        };
      },
    }),
    {
      name: PUCK_CONFIG_KEYS.shellLayout,
      storage: shellLayoutStorage,
      skipHydration: true,
      partialize: (state) => ({
        layout: state.layout,
        terminalSide: state.terminalSide,
      }),
      merge: (persisted, current) => {
        const state = persisted as Partial<ShellLayoutStore> | undefined;
        if (!state?.layout) return current;
        return {
          ...current,
          layout: migrateStoredLayout(state.layout),
          terminalSide: migrateStoredTerminalSide(state.terminalSide),
        };
      },
    },
  ),
);

export { migrateStoredLayout, DEFAULT_LAYOUT };

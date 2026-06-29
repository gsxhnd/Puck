/**
 * Global application settings store (theme, terminal, language, panels).
 *
 * 全局应用设置 store：主题模式与配色、终端外观（字体、字号、光标闪烁、回滚
 * 行数、选中即复制）、界面语言、面板可见性以及默认会话权限。带版本号的迁移
 * 逻辑负责把历史持久化数据规整为当前结构，并对非法值（如越界的回滚行数）做
 * 归一化处理。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { puckPersistStorage, PUCK_CONFIG_KEYS } from "@/lib/puck-config-storage";
import {
  DEFAULT_COLOR_THEME,
  isColorThemeId,
  type ColorThemeId,
} from "@/lib/color-themes";
import {
  type AppLanguage,
  type AppSettings,
  type ThemeMode,
  DEFAULT_APP_SETTINGS,
  DEFAULT_TERMINAL_FONT_FAMILY,
} from "@/types/settings";
import {
  DEFAULT_SESSION_PRIVILEGES,
  type SessionPrivilegeKey,
  type SessionPrivileges,
} from "@/types/session-privileges";
import i18n from "@/i18n";
import { applyUiTheme } from "@/lib/apply-ui-theme";

type AppSettingsState = AppSettings & {
  setLanguage: (language: AppLanguage) => void;
  setColorTheme: (colorTheme: ColorThemeId) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setCursorBlink: (cursorBlink: boolean) => void;
  setScrollback: (scrollback: number) => void;
  setCopyOnSelect: (copyOnSelect: boolean) => void;
  setOpenLocalTerminalOnStart: (open: boolean) => void;
  setPrimaryPanelOpen: (open: boolean) => void;
  setSecondPanelOpen: (open: boolean) => void;
  setDefaultPrivilege: (
    key: SessionPrivilegeKey,
    value: boolean,
  ) => void;
  reset: () => void;
};

type PersistedAppSettings = Partial<AppSettings> & {
  uiTheme?: ThemeMode;
};

function normalizeTerminalFontFamily(fontFamily?: string): string {
  if (!fontFamily) return DEFAULT_TERMINAL_FONT_FAMILY;
  if (/inter/i.test(fontFamily)) return DEFAULT_TERMINAL_FONT_FAMILY;
  return fontFamily;
}

function normalizeScrollback(scrollback?: number): number {
  if (!scrollback || Number.isNaN(scrollback)) {
    return DEFAULT_APP_SETTINGS.scrollback;
  }
  return Math.min(50000, Math.max(1000, scrollback));
}

function normalizeDefaultPrivileges(
  privileges?: Partial<SessionPrivileges>,
): SessionPrivileges {
  return {
    ...DEFAULT_SESSION_PRIVILEGES,
    ...privileges,
  };
}

function migratePersistedSettings(
  persisted: PersistedAppSettings,
): AppSettings {
  const themeMode =
    persisted.themeMode ??
    persisted.uiTheme ??
    DEFAULT_APP_SETTINGS.themeMode;
  const colorTheme =
    persisted.colorTheme && isColorThemeId(persisted.colorTheme)
      ? persisted.colorTheme
      : DEFAULT_COLOR_THEME;

  return {
    language: persisted.language ?? DEFAULT_APP_SETTINGS.language,
    colorTheme,
    themeMode,
    fontFamily: normalizeTerminalFontFamily(persisted.fontFamily),
    fontSize: persisted.fontSize ?? DEFAULT_APP_SETTINGS.fontSize,
    cursorBlink: persisted.cursorBlink ?? DEFAULT_APP_SETTINGS.cursorBlink,
    scrollback: normalizeScrollback(persisted.scrollback),
    copyOnSelect: persisted.copyOnSelect ?? DEFAULT_APP_SETTINGS.copyOnSelect,
    openLocalTerminalOnStart:
      persisted.openLocalTerminalOnStart ??
      DEFAULT_APP_SETTINGS.openLocalTerminalOnStart,
    primaryPanelOpen:
      persisted.primaryPanelOpen ?? DEFAULT_APP_SETTINGS.primaryPanelOpen,
    secondPanelOpen:
      persisted.secondPanelOpen ?? DEFAULT_APP_SETTINGS.secondPanelOpen,
    defaultSessionPrivileges: normalizeDefaultPrivileges(
      persisted.defaultSessionPrivileges,
    ),
  };
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_APP_SETTINGS,
      setLanguage: (language) => {
        void i18n.changeLanguage(language);
        set({ language });
      },
      setColorTheme: (colorTheme) => {
        set({ colorTheme });
        const { themeMode } = useAppSettingsStore.getState();
        applyUiTheme(themeMode, colorTheme);
      },
      setThemeMode: (themeMode) => {
        set({ themeMode });
        const { colorTheme } = useAppSettingsStore.getState();
        applyUiTheme(themeMode, colorTheme);
      },
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setCursorBlink: (cursorBlink) => set({ cursorBlink }),
      setScrollback: (scrollback) =>
        set({ scrollback: normalizeScrollback(scrollback) }),
      setCopyOnSelect: (copyOnSelect) => set({ copyOnSelect }),
      setOpenLocalTerminalOnStart: (openLocalTerminalOnStart) =>
        set({ openLocalTerminalOnStart }),
      setPrimaryPanelOpen: (primaryPanelOpen) => set({ primaryPanelOpen }),
      setSecondPanelOpen: (secondPanelOpen) => set({ secondPanelOpen }),
      setDefaultPrivilege: (key, value) =>
        set((state) => ({
          defaultSessionPrivileges: {
            ...state.defaultSessionPrivileges,
            [key]: value,
          },
        })),
      reset: () => {
        set({ ...DEFAULT_APP_SETTINGS });
        applyUiTheme(
          DEFAULT_APP_SETTINGS.themeMode,
          DEFAULT_APP_SETTINGS.colorTheme,
        );
      },
    }),
    {
      name: PUCK_CONFIG_KEYS.appSettings,
      storage: puckPersistStorage,
      version: 3,
      migrate: (persistedState) =>
        migratePersistedSettings(persistedState as PersistedAppSettings),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyUiTheme(state.themeMode, state.colorTheme);
        if (state.language) {
          void i18n.changeLanguage(state.language);
        }
      },
    },
  ),
);

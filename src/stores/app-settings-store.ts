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
  BUILTIN_COLOR_THEME_ID,
  isValidColorThemeId,
  type ColorThemeId,
} from "@/lib/color-themes";
import {
  type AppLanguage,
  type AppSettings,
  type ThemeMode,
  DEFAULT_APP_SETTINGS,
  DEFAULT_SYSTEM_RESOURCE_METRICS,
  DEFAULT_TERMINAL_FONT_FAMILY,
  SYSTEM_RESOURCE_POLL_INTERVALS_MS,
  type SystemResourceMetricKey,
  type SystemResourceMetrics,
  type SystemResourcePollIntervalMs,
} from "@/types/settings";
import {
  DEFAULT_SESSION_PRIVILEGES,
  type SessionPrivilegeKey,
  type SessionPrivileges,
} from "@/types/session-privileges";
import i18n from "@/i18n";
import { applyUiTheme } from "@/lib/apply-ui-theme";
import { applyUiAppearanceOverrides } from "@/lib/apply-ui-appearance";
import {
  uiAppearanceToOverrides,
  type UiAppearanceOverrides,
} from "@/lib/ui-appearance-css";
import {
  normalizeUiAppearanceOverrides,
  type UiAppearance,
} from "@/types/ui-appearance";

type AppSettingsState = AppSettings & {
  setLanguage: (language: AppLanguage) => void;
  setColorTheme: (colorTheme: ColorThemeId) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  setUiAppearance: (patch: Partial<UiAppearance>) => void;
  clearUiAppearanceOverrides: () => void;
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
  setSystemResourcesLocalPollIntervalMs: (
    intervalMs: SystemResourcePollIntervalMs,
  ) => void;
  setSystemResourcesRemotePollIntervalMs: (
    intervalMs: SystemResourcePollIntervalMs,
  ) => void;
  setSystemResourceMetric: (
    key: SystemResourceMetricKey,
    enabled: boolean,
  ) => void;
  reset: () => void;
};

type PersistedAppSettings = Partial<AppSettings> & {
  uiTheme?: ThemeMode;
  /** @deprecated Migrated to uiAppearanceOverrides in v6. */
  uiAppearance?: Partial<UiAppearance>;
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

function normalizePollIntervalMs(
  intervalMs?: number,
  fallback: SystemResourcePollIntervalMs = DEFAULT_APP_SETTINGS.systemResourcesLocalPollIntervalMs,
): SystemResourcePollIntervalMs {
  if (
    intervalMs &&
    SYSTEM_RESOURCE_POLL_INTERVALS_MS.includes(
      intervalMs as SystemResourcePollIntervalMs,
    )
  ) {
    return intervalMs as SystemResourcePollIntervalMs;
  }
  return fallback;
}

function normalizeSystemResourceMetrics(
  metrics?: Partial<SystemResourceMetrics>,
): SystemResourceMetrics {
  return {
    ...DEFAULT_SYSTEM_RESOURCE_METRICS,
    ...metrics,
  };
}

type PersistedAppSettingsEnvelope = {
  state?: PersistedAppSettings;
  version?: number;
};

function unwrapPersistedSettings(
  persistedState: unknown,
): PersistedAppSettings {
  if (!persistedState || typeof persistedState !== "object") {
    return {};
  }

  if ("state" in persistedState) {
    return (persistedState as PersistedAppSettingsEnvelope).state ?? {};
  }

  return persistedState as PersistedAppSettings;
}

function migratePersistedSettings(
  persisted: PersistedAppSettings,
): AppSettings {
  const themeMode =
    persisted.themeMode ??
    persisted.uiTheme ??
    DEFAULT_APP_SETTINGS.themeMode;
  const colorTheme =
    persisted.colorTheme && isValidColorThemeId(persisted.colorTheme)
      ? persisted.colorTheme
      : BUILTIN_COLOR_THEME_ID;

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
    systemResourcesLocalPollIntervalMs: normalizePollIntervalMs(
      persisted.systemResourcesLocalPollIntervalMs,
      DEFAULT_APP_SETTINGS.systemResourcesLocalPollIntervalMs,
    ),
    systemResourcesRemotePollIntervalMs: normalizePollIntervalMs(
      persisted.systemResourcesRemotePollIntervalMs,
      DEFAULT_APP_SETTINGS.systemResourcesRemotePollIntervalMs,
    ),
    systemResourcesMetrics: normalizeSystemResourceMetrics(
      persisted.systemResourcesMetrics,
    ),
    uiAppearanceOverrides: migrateUiAppearanceOverrides(persisted),
  };
}

function migrateUiAppearanceOverrides(
  persisted: PersistedAppSettings,
): UiAppearanceOverrides {
  if (persisted.uiAppearanceOverrides) {
    return normalizeUiAppearanceOverrides(persisted.uiAppearanceOverrides);
  }
  if (persisted.uiAppearance) {
    return normalizeUiAppearanceOverrides(
      uiAppearanceToOverrides(persisted.uiAppearance),
    );
  }
  return {};
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
        void applyUiTheme(themeMode, colorTheme);
      },
      setThemeMode: (themeMode) => {
        set({ themeMode });
        const { colorTheme } = useAppSettingsStore.getState();
        void applyUiTheme(themeMode, colorTheme);
      },
      setUiAppearance: (patch) => {
        set((state) => ({
          uiAppearanceOverrides: normalizeUiAppearanceOverrides({
            ...state.uiAppearanceOverrides,
            ...patch,
          }),
        }));
        applyUiAppearanceOverrides(
          useAppSettingsStore.getState().uiAppearanceOverrides,
        );
      },
      clearUiAppearanceOverrides: () => {
        set({ uiAppearanceOverrides: {} });
        applyUiAppearanceOverrides({});
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
      setSystemResourcesLocalPollIntervalMs: (
        systemResourcesLocalPollIntervalMs,
      ) =>
        set({
          systemResourcesLocalPollIntervalMs: normalizePollIntervalMs(
            systemResourcesLocalPollIntervalMs,
            DEFAULT_APP_SETTINGS.systemResourcesLocalPollIntervalMs,
          ),
        }),
      setSystemResourcesRemotePollIntervalMs: (
        systemResourcesRemotePollIntervalMs,
      ) =>
        set({
          systemResourcesRemotePollIntervalMs: normalizePollIntervalMs(
            systemResourcesRemotePollIntervalMs,
            DEFAULT_APP_SETTINGS.systemResourcesRemotePollIntervalMs,
          ),
        }),
      setSystemResourceMetric: (key, enabled) =>
        set((state) => ({
          systemResourcesMetrics: {
            ...state.systemResourcesMetrics,
            [key]: enabled,
          },
        })),
      reset: () => {
        set({ ...DEFAULT_APP_SETTINGS });
        applyUiAppearanceOverrides({});
        void applyUiTheme(
          DEFAULT_APP_SETTINGS.themeMode,
          DEFAULT_APP_SETTINGS.colorTheme,
        );
      },
    }),
    {
      name: PUCK_CONFIG_KEYS.appSettings,
      storage: puckPersistStorage,
      skipHydration: true,
      version: 6,
      migrate: (persistedState) => ({
        state: migratePersistedSettings(unwrapPersistedSettings(persistedState)),
        version: 6,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyUiAppearanceOverrides(state.uiAppearanceOverrides);
        void applyUiTheme(state.themeMode, state.colorTheme);
        if (state.language) {
          void i18n.changeLanguage(state.language);
        }
      },
    },
  ),
);

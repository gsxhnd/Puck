import { create } from "zustand";
import { persist } from "zustand/middleware";
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
import i18n from "@/i18n";

type AppSettingsState = AppSettings & {
  setLanguage: (language: AppLanguage) => void;
  setColorTheme: (colorTheme: ColorThemeId) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setOpenLocalTerminalOnStart: (open: boolean) => void;
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
    openLocalTerminalOnStart:
      persisted.openLocalTerminalOnStart ??
      DEFAULT_APP_SETTINGS.openLocalTerminalOnStart,
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
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setOpenLocalTerminalOnStart: (openLocalTerminalOnStart) =>
        set({ openLocalTerminalOnStart }),
      reset: () => set({ ...DEFAULT_APP_SETTINGS }),
    }),
    {
      name: "puck-app-settings",
      version: 2,
      migrate: (persistedState) =>
        migratePersistedSettings(persistedState as PersistedAppSettings),
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          void i18n.changeLanguage(state.language);
        }
      },
    },
  ),
);

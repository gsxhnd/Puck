import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type AppLanguage,
  type AppSettings,
  type TerminalThemeId,
  type UiTheme,
  DEFAULT_APP_SETTINGS,
} from "@/types/settings";
import i18n from "@/i18n";

type AppSettingsState = AppSettings & {
  setLanguage: (language: AppLanguage) => void;
  setUiTheme: (theme: UiTheme) => void;
  setTerminalThemeId: (id: TerminalThemeId) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setOpenLocalTerminalOnStart: (open: boolean) => void;
  reset: () => void;
};

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_APP_SETTINGS,
      setLanguage: (language) => {
        void i18n.changeLanguage(language);
        set({ language });
      },
      setUiTheme: (uiTheme) => set({ uiTheme }),
      setTerminalThemeId: (terminalThemeId) => set({ terminalThemeId }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setOpenLocalTerminalOnStart: (openLocalTerminalOnStart) =>
        set({ openLocalTerminalOnStart }),
      reset: () => set({ ...DEFAULT_APP_SETTINGS }),
    }),
    {
      name: "puck-app-settings",
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          void i18n.changeLanguage(state.language);
        }
      },
    },
  ),
);

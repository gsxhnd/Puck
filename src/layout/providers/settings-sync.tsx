import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppSettingsStore } from "@/stores/app-settings-store";

const SETTINGS_STORAGE_KEY = "puck-app-settings";

/** Rehydrate persisted settings when another window updates localStorage. */
export function SettingsSync() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_STORAGE_KEY) return;
      void (async () => {
        await useAppSettingsStore.persist.rehydrate();
        const { uiTheme, language } = useAppSettingsStore.getState();
        setTheme(uiTheme);
        const { default: i18n } = await import("@/i18n");
        await i18n.changeLanguage(language);
      })();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setTheme]);

  return null;
}

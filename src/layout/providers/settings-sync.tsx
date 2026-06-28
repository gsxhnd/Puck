import { useEffect } from "react";
import { useAppSettingsStore } from "@/stores/app-settings-store";

const SETTINGS_STORAGE_KEY = "puck-app-settings";

/** Rehydrate persisted settings when another window updates localStorage. */
export function SettingsSync() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_STORAGE_KEY) return;
      void (async () => {
        await useAppSettingsStore.persist.rehydrate();
        const { language } = useAppSettingsStore.getState();
        const { default: i18n } = await import("@/i18n");
        if (i18n.language !== language) {
          await i18n.changeLanguage(language);
        }
      })();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

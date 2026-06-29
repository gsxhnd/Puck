import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import i18n from "@/i18n";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import {
  PUCK_CONFIG_KEYS,
  reloadPuckConfigKey,
} from "@/lib/puck-config-storage";
import { isTauri } from "@/lib/platform";

async function rehydrateSettings() {
  await reloadPuckConfigKey(PUCK_CONFIG_KEYS.appSettings);
  await useAppSettingsStore.persist.rehydrate();
  const { language, primaryPanelOpen, secondPanelOpen } =
    useAppSettingsStore.getState();
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
  useShellUiStore.getState().setPrimaryPanelOpen(primaryPanelOpen);
  useShellUiStore.getState().setSecondPanelOpen(secondPanelOpen);
}

/** Rehydrate persisted settings when another window updates config files. */
export function SettingsSync() {
  useEffect(() => {
    if (isTauri()) {
      const unlisten = listen<string>("puck:config-changed", (event) => {
        if (event.payload !== PUCK_CONFIG_KEYS.appSettings) return;
        void rehydrateSettings();
      });
      return () => {
        void unlisten.then((dispose) => dispose());
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== PUCK_CONFIG_KEYS.appSettings) return;
      void rehydrateSettings();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

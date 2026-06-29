/**
 * Cross-window synchronization for application settings.
 *
 * 应用设置的跨窗口同步。监听 `puck:config-changed`（浏览器下为 storage 事件），
 * 重新加载并 rehydrate 设置 store，随后把语言、主/次面板可见性等需要立即生效
 * 的设置应用到 i18n 与 shell UI store，使设置窗口的改动实时反映到主窗口。
 */
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

// 重新加载设置区段并把跨窗口需同步的派生状态（语言、面板可见性）应用到运行时。
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

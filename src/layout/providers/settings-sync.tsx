/**
 * Cross-window synchronization for application settings.
 *
 * 应用设置的跨窗口同步。监听 `puck:config-changed`（浏览器下为 storage 事件），
 * 重新加载并 rehydrate 设置 store，随后把主题、语言、主/次面板可见性等需要立即生效
 * 的设置应用到运行时，使设置/连接管理等辅助窗口与主窗口保持一致。
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { rehydrateAppSettings } from "@/lib/rehydrate-app-settings";
import {
  PUCK_CONFIG_KEYS,
} from "@/lib/puck-config-storage";
import { isTauri } from "@/lib/platform";

/** Rehydrate persisted settings when another window updates config files. */
export function SettingsSync() {
  useEffect(() => {
    if (isTauri()) {
      const unlisten = listen<string>("puck:config-changed", (event) => {
        if (event.payload !== PUCK_CONFIG_KEYS.appSettings) return;
        void rehydrateAppSettings();
      });
      return () => {
        void unlisten.then((dispose) => dispose());
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== PUCK_CONFIG_KEYS.appSettings) return;
      void rehydrateAppSettings();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

/**
 * Cross-window synchronization for the connection store.
 *
 * 连接列表的跨窗口同步。当任意窗口修改了连接配置时，后端会广播
 * `puck:config-changed` 事件（浏览器下退化为 storage 事件），本组件据此
 * 重新加载配置并刷新 Zustand store，使所有窗口保持一致。
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useConnectionStore } from "@/stores/connection-store";
import {
  PUCK_CONFIG_KEYS,
  reloadPuckConfigKey,
} from "@/lib/puck-config-storage";
import { isTauri } from "@/lib/platform";

export const CONNECTION_STORAGE_KEY = PUCK_CONFIG_KEYS.connections;

// 先从磁盘/后端重新拉取连接区段到缓存，再触发 Zustand rehydrate。
async function rehydrateConnections() {
  await reloadPuckConfigKey(CONNECTION_STORAGE_KEY);
  await useConnectionStore.persist.rehydrate();
}

/** Rehydrate persisted connections when another window updates config files. */
export function ConnectionSync() {
  useEffect(() => {
    if (isTauri()) {
      const unlisten = listen<string>("puck:config-changed", (event) => {
        if (event.payload !== CONNECTION_STORAGE_KEY) return;
        void rehydrateConnections();
      });
      return () => {
        void unlisten.then((dispose) => dispose());
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== CONNECTION_STORAGE_KEY) return;
      void rehydrateConnections();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

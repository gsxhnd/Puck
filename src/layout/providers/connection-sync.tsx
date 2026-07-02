/**
 * Cross-window synchronization for the connection store.
 *
 * 连接列表的跨窗口同步。当任意窗口修改了 `connections.json` 时，后端会广播
 * `puck:connections-changed` 事件（浏览器下退化为 storage 事件），本组件据此
 * 重新加载并刷新 Zustand store。
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { rehydrateConnections } from "@/lib/rehydrate-connections";
import { CONNECTIONS_PERSIST_KEY } from "@/lib/connection-persist-storage";
import { isTauri } from "@/lib/platform";

const BROWSER_STORAGE_KEY = "puck-connections";

/** Rehydrate persisted connections when another window updates the connections file. */
export function ConnectionSync() {
  useEffect(() => {
    if (isTauri()) {
      const unlisten = listen("puck:connections-changed", () => {
        void rehydrateConnections();
      });
      return () => {
        void unlisten.then((dispose) => dispose());
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== BROWSER_STORAGE_KEY) return;
      void rehydrateConnections();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

export { CONNECTIONS_PERSIST_KEY };

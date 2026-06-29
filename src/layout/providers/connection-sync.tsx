import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useConnectionStore } from "@/stores/connection-store";
import {
  PUCK_CONFIG_KEYS,
  reloadPuckConfigKey,
} from "@/lib/puck-config-storage";
import { isTauri } from "@/lib/platform";

export const CONNECTION_STORAGE_KEY = PUCK_CONFIG_KEYS.connections;

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

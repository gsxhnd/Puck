/**
 * Zustand persistence adapter for saved connection profiles.
 *
 * 连接配置的专用持久化适配器。Tauri 下读写 `connections.json`，浏览器下回退到
 * localStorage。与 `config.toml` 区段分离，跨窗口通过 `puck:connections-changed`
 * 事件同步。
 */
import { invoke } from "@tauri-apps/api/core";
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { isTauri } from "@/lib/platform";

/** Zustand persist storage name and browser localStorage key. */
export const CONNECTIONS_PERSIST_KEY = "connections";

const BROWSER_STORAGE_KEY = "puck-connections";

let cachedValue: string | null = null;
let initPromise: Promise<void> | null = null;

async function loadFromDisk(): Promise<void> {
  if (!isTauri()) {
    try {
      cachedValue = localStorage.getItem(BROWSER_STORAGE_KEY);
    } catch {
      cachedValue = null;
    }
    return;
  }

  cachedValue = await invoke<string | null>("load_connections");
}

/** Preload connections.json before Zustand hydration. */
export function initConnectionPersistStorage(): Promise<void> {
  if (!initPromise) {
    initPromise = loadFromDisk().then(() => undefined);
  }
  return initPromise;
}

export async function reloadConnectionPersistStorage(): Promise<void> {
  initPromise = null;
  await initConnectionPersistStorage();
}

export function readConnectionPersistValue(): string | null {
  return cachedValue;
}

const connectionStorage: StateStorage = {
  getItem: () => readConnectionPersistValue(),
  setItem: (_name, value) => {
    cachedValue = value;
    if (isTauri()) {
      void invoke("save_connections", { value });
      return;
    }
    try {
      localStorage.setItem(BROWSER_STORAGE_KEY, value);
    } catch {
      // Ignore quota or private browsing errors.
    }
  },
  removeItem: () => {
    cachedValue = null;
    if (isTauri()) {
      void invoke("remove_connections");
      return;
    }
    try {
      localStorage.removeItem(BROWSER_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  },
};

export const connectionPersistStorage = createJSONStorage(
  () => connectionStorage,
);

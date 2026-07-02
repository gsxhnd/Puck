/**
 * Zustand persistence adapter backed by the Rust config store.
 *
 * 为 Zustand 提供持久化存储适配器。在 Tauri 环境下通过 invoke 读写后端的
 * `config.toml`（按区段保存 JSON 字符串），在浏览器环境下回退到 localStorage。
 * 模块内维护一份内存缓存，使 Zustand 的同步 `getItem` 能直接命中。
 * 连接配置使用独立的 `connection-persist-storage.ts`。
 */
import { invoke } from "@tauri-apps/api/core";
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { isTauri } from "@/lib/platform";

/** Section keys in ~/.config/puck/config.toml */
export const PUCK_CONFIG_KEYS = {
  appSettings: "app_settings",
  sidebarLayout: "sidebar_layout",
  hostsLayout: "hosts_layout",
  sessionPrivileges: "session_privileges",
  shellLayout: "shell_layout",
} as const;

const cache = new Map<string, string | null>();
let initPromise: Promise<void> | null = null;

async function loadSectionsFromDisk(): Promise<void> {
  if (!isTauri()) return;

  const sections = await invoke<Record<string, string>>(
    "load_puck_config_sections",
  );
  for (const [key, value] of Object.entries(sections)) {
    cache.set(key, value);
  }
}

/** Preload config.toml before Zustand hydration. */
export function initPuckConfigStorage(): Promise<void> {
  if (!initPromise) {
    initPromise = loadSectionsFromDisk().then(() => undefined);
  }
  return initPromise;
}

export async function reloadPuckConfigKey(key: string): Promise<void> {
  if (isTauri()) {
    const value = await invoke<string | null>("get_puck_config_section", {
      section: key,
    });
    cache.set(key, value);
    return;
  }

  try {
    cache.set(key, localStorage.getItem(key));
  } catch {
    cache.set(key, null);
  }
}

/** Synchronously reads a section value from the in-memory cache. */
export function readPuckConfigValue(key: string): string | null {
  return cache.get(key) ?? null;
}

export async function writePuckConfigValue(
  key: string,
  value: string,
): Promise<void> {
  await initPuckConfigStorage();
  puckConfigStorage.setItem(key, value);
}

export const puckConfigStorage: StateStorage = {
  getItem: (name) => readPuckConfigValue(name),
  setItem: (name, value) => {
    cache.set(name, value);
    if (isTauri()) {
      void invoke("set_puck_config_section", { section: name, value });
      return;
    }
    try {
      localStorage.setItem(name, value);
    } catch {
      // Ignore quota or private browsing errors.
    }
  },
  removeItem: (name) => {
    cache.delete(name);
    if (isTauri()) {
      void invoke("remove_puck_config_section", { section: name });
      return;
    }
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore storage errors.
    }
  },
};

export const puckPersistStorage = createJSONStorage(() => puckConfigStorage);

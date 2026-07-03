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
const writeQueues = new Map<string, Promise<void>>();

async function persistSection(key: string, value: string): Promise<void> {
  if (!isTauri()) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore quota or private browsing errors.
    }
    return;
  }

  try {
    await invoke("set_puck_config_section", { section: key, value });
  } catch (error) {
    console.warn(`Failed to persist config section "${key}":`, error);
  }
}

function enqueueSectionWrite(key: string, value: string): Promise<void> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => persistSection(key, value));
  writeQueues.set(key, next);
  return next;
}

async function removeSection(key: string): Promise<void> {
  if (!isTauri()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors.
    }
    return;
  }

  try {
    await invoke("remove_puck_config_section", { section: key });
  } catch (error) {
    console.warn(`Failed to remove config section "${key}":`, error);
  }
}

async function loadSectionsFromDisk(): Promise<void> {
  if (!isTauri()) return;

  const sections = await invoke<Record<string, string>>(
    "load_puck_config_sections",
  );
  for (const [key, value] of Object.entries(sections)) {
    cache.set(key, value);
  }
}

/** Returns startup warnings emitted when config.toml had to be recovered. */
export async function getConfigLoadWarnings(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("get_config_load_warnings");
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
  cache.set(key, value);
  await enqueueSectionWrite(key, value);
}

export const puckConfigStorage: StateStorage = {
  getItem: (name) => readPuckConfigValue(name),
  setItem: (name, value) => {
    cache.set(name, value);
    void enqueueSectionWrite(name, value);
  },
  removeItem: (name) => {
    cache.delete(name);
    void removeSection(name);
  },
};

export const puckPersistStorage = createJSONStorage(() => puckConfigStorage);

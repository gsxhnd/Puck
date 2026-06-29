/**
 * Zustand persistence adapter backed by the Rust config store.
 *
 * 为 Zustand 提供持久化存储适配器。在 Tauri 环境下通过 invoke 读写后端的
 * `config.toml`（按区段保存 JSON 字符串），在浏览器环境下回退到
 * localStorage。模块内维护一份内存缓存，使 Zustand 的同步 `getItem` 能直接
 * 命中，避免每次读取都走异步 IPC；同时负责把旧版 localStorage 数据迁移到后端。
 */
import { invoke } from "@tauri-apps/api/core";
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { isTauri } from "@/lib/platform";

/** Section keys in ~/.config/puck/config.toml */
export const PUCK_CONFIG_KEYS = {
  appSettings: "app_settings",
  connections: "connections",
  sidebarLayout: "sidebar_layout",
  hostsLayout: "hosts_layout",
  sessionPrivileges: "session_privileges",
  shellLayout: "shell_layout",
} as const;

const LEGACY_LOCAL_STORAGE_KEYS: Record<string, string> = {
  "puck-app-settings": PUCK_CONFIG_KEYS.appSettings,
  "puck-connections": PUCK_CONFIG_KEYS.connections,
  "puck-sidebar-layout": PUCK_CONFIG_KEYS.sidebarLayout,
  "puck-hosts-layout": PUCK_CONFIG_KEYS.hostsLayout,
  "puck-session-privileges": PUCK_CONFIG_KEYS.sessionPrivileges,
  "puck-shell-layout": PUCK_CONFIG_KEYS.shellLayout,
};

// section -> 已序列化的 JSON 字符串（null 表示该区段不存在）。
// 作为后端/localStorage 的同步读缓存，供 Zustand 的 getItem 直接命中。
const cache = new Map<string, string | null>();
// 保证磁盘加载 + 迁移流程只执行一次的单例 Promise。
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

async function migrateLegacyLocalStorage(): Promise<void> {
  let migrated = false;

  for (const [legacyKey, section] of Object.entries(LEGACY_LOCAL_STORAGE_KEYS)) {
    if (cache.get(section) != null) continue;

    try {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy === null) continue;
      cache.set(section, legacy);
      localStorage.removeItem(legacyKey);
      migrated = true;
    } catch {
      // Ignore private browsing or disabled storage.
    }
  }

  if (!migrated || !isTauri()) return;

  await Promise.all(
    [...cache.entries()]
      .filter((entry): entry is [string, string] => entry[1] !== null)
      .map(([section, value]) =>
        invoke("set_puck_config_section", { section, value }),
      ),
  );
}

/** Preload config.toml before Zustand hydration. */
export function initPuckConfigStorage(): Promise<void> {
  if (!initPromise) {
    initPromise = loadSectionsFromDisk()
      .then(() => migrateLegacyLocalStorage())
      .then(() => undefined);
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

/**
 * The `StateStorage` implementation handed to Zustand's persist middleware.
 *
 * 交给 Zustand persist 中间件使用的存储实现。读为同步（命中缓存），写则
 * 先更新缓存再异步落盘：Tauri 下走 invoke，浏览器下走 localStorage，并对
 * 存储异常做静默降级。
 */
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

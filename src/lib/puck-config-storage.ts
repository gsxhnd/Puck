import { invoke } from "@tauri-apps/api/core";
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { isTauri } from "@/lib/platform";

/** Section keys in ~/.config/puck/config.toml */
export const PUCK_CONFIG_KEYS = {
  appSettings: "app_settings",
  connections: "connections",
  sidebarLayout: "sidebar_layout",
  sessionPrivileges: "session_privileges",
  shellLayout: "shell_layout",
} as const;

const LEGACY_LOCAL_STORAGE_KEYS: Record<string, string> = {
  "puck-app-settings": PUCK_CONFIG_KEYS.appSettings,
  "puck-connections": PUCK_CONFIG_KEYS.connections,
  "puck-sidebar-layout": PUCK_CONFIG_KEYS.sidebarLayout,
  "puck-session-privileges": PUCK_CONFIG_KEYS.sessionPrivileges,
  "puck-shell-layout": PUCK_CONFIG_KEYS.shellLayout,
};

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

import {
  BUILTIN_COLOR_THEME_ID,
  type ColorThemeId,
} from "@/lib/color-themes";
import { ensureColorThemeStylesLoaded } from "@/lib/color-theme-registry";
import {
  buildTerminalThemeKey,
  syncTerminalThemeCache,
} from "@/lib/terminal-theme-bridge";
import { getEffectiveTheme } from "@/lib/theme-utils";
import type { ThemeMode } from "@/types/settings";

const NEXT_THEMES_STORAGE_KEY = "theme";

let syncNextThemeMode: ((themeMode: ThemeMode) => void) | null = null;

/** Registers next-themes `setTheme` for imperative UI theme updates. */
export function registerNextThemeModeSync(
  sync: (themeMode: ThemeMode) => void,
): () => void {
  syncNextThemeMode = sync;
  return () => {
    if (syncNextThemeMode === sync) {
      syncNextThemeMode = null;
    }
  };
}

/** Applies color palette + light/dark mode to `document.documentElement`. */
export function applyDocumentTheme(
  themeMode: ThemeMode,
  colorTheme: ColorThemeId,
): void {
  if (typeof document === "undefined") return;

  const effectiveTheme = getEffectiveTheme(themeMode);
  document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
  document.documentElement.dataset.colorTheme =
    colorTheme ?? BUILTIN_COLOR_THEME_ID;

  try {
    localStorage.setItem(NEXT_THEMES_STORAGE_KEY, themeMode);
  } catch {
    // Ignore private browsing or disabled storage.
  }
}

export function scheduleTerminalThemeSync(
  themeMode: ThemeMode,
  colorTheme: ColorThemeId,
): void {
  if (typeof window === "undefined") return;

  const effectiveTheme = getEffectiveTheme(themeMode);
  requestAnimationFrame(() => {
    syncTerminalThemeCache(
      buildTerminalThemeKey(effectiveTheme, colorTheme),
    );
  });
}

/** Sync DOM, next-themes, and xterm palette after settings change or rehydrate. */
export async function applyUiTheme(
  themeMode: ThemeMode,
  colorTheme: ColorThemeId,
): Promise<void> {
  const resolvedTheme = await ensureColorThemeStylesLoaded(colorTheme);
  applyDocumentTheme(themeMode, resolvedTheme);
  syncNextThemeMode?.(themeMode);
  scheduleTerminalThemeSync(themeMode, resolvedTheme);
}

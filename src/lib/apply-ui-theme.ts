import { DEFAULT_COLOR_THEME, type ColorThemeId } from "@/lib/color-themes";
import {
  buildTerminalThemeKey,
  syncTerminalThemeCache,
} from "@/lib/terminal-theme-bridge";
import { getEffectiveTheme } from "@/lib/theme-utils";
import type { ThemeMode } from "@/types/settings";

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
    colorTheme ?? DEFAULT_COLOR_THEME;
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
export function applyUiTheme(
  themeMode: ThemeMode,
  colorTheme: ColorThemeId,
): void {
  applyDocumentTheme(themeMode, colorTheme);
  syncNextThemeMode?.(themeMode);
  scheduleTerminalThemeSync(themeMode, colorTheme);
}

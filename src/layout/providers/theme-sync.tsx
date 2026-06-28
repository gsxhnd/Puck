import { useLayoutEffect } from "react";
import { useTheme } from "next-themes";
import { DEFAULT_COLOR_THEME } from "@/lib/color-themes";
import {
  buildTerminalThemeKey,
  syncTerminalThemeCache,
} from "@/lib/terminal-theme-bridge";
import { getEffectiveTheme } from "@/lib/theme-utils";
import { useAppSettingsStore } from "@/stores/app-settings-store";

/** Keeps document theme attributes in sync with persisted settings. */
export function ThemeSync() {
  const { setTheme } = useTheme();
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);
  const effectiveTheme = getEffectiveTheme(themeMode);

  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle(
      "dark",
      effectiveTheme === "dark",
    );
    document.documentElement.dataset.colorTheme =
      colorTheme ?? DEFAULT_COLOR_THEME;
  }

  useLayoutEffect(() => {
    setTheme(themeMode);
    syncTerminalThemeCache(
      buildTerminalThemeKey(effectiveTheme, colorTheme),
    );

    if (themeMode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const nextTheme = getEffectiveTheme("system");
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
      syncTerminalThemeCache(
        buildTerminalThemeKey(nextTheme, colorTheme),
      );
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [colorTheme, effectiveTheme, setTheme, themeMode]);

  return null;
}

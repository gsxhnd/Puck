import { useEffect } from "react";
import { useTheme } from "next-themes";
import { DEFAULT_COLOR_THEME } from "@/lib/color-themes";
import { useAppSettingsStore } from "@/stores/app-settings-store";

/** Keeps next-themes and document theme attributes in sync with persisted settings. */
export function ThemeSync() {
  const { setTheme } = useTheme();
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);

  useEffect(() => {
    setTheme(themeMode);
  }, [setTheme, themeMode]);

  useEffect(() => {
    document.documentElement.dataset.colorTheme =
      colorTheme ?? DEFAULT_COLOR_THEME;
  }, [colorTheme]);

  return null;
}

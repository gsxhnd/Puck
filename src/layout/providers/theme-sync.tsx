import { useLayoutEffect } from "react";
import { useTheme } from "next-themes";
import { applyUiTheme, registerNextThemeModeSync } from "@/lib/apply-ui-theme";
import { useAppSettingsStore } from "@/stores/app-settings-store";

/** Keeps document theme attributes in sync with persisted settings. */
export function ThemeSync() {
  const { setTheme } = useTheme();
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);

  useLayoutEffect(() => registerNextThemeModeSync(setTheme), [setTheme]);

  useLayoutEffect(() => {
    void applyUiTheme(themeMode, colorTheme);
  }, [colorTheme, themeMode]);

  useLayoutEffect(() => {
    if (themeMode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      void applyUiTheme("system", colorTheme);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [colorTheme, themeMode]);

  return null;
}

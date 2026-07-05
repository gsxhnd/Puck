import { useLayoutEffect } from "react";
import { useTheme } from "next-themes";
import { applyUiAppearanceOverrides } from "@/lib/apply-ui-appearance";
import { applyUiTheme, registerNextThemeModeSync } from "@/lib/apply-ui-theme";
import { useAppSettingsStore } from "@/stores/app-settings-store";

/** Keeps document theme attributes in sync with persisted settings. */
export function ThemeSync() {
  const { setTheme } = useTheme();
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);
  const uiAppearanceOverrides = useAppSettingsStore(
    (state) => state.uiAppearanceOverrides,
  );

  useLayoutEffect(() => registerNextThemeModeSync(setTheme), [setTheme]);

  useLayoutEffect(() => {
    void applyUiTheme(themeMode, colorTheme).then(() => {
      applyUiAppearanceOverrides(uiAppearanceOverrides);
    });
  }, [colorTheme, themeMode, uiAppearanceOverrides]);

  useLayoutEffect(() => {
    if (themeMode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      void applyUiTheme("system", colorTheme).then(() => {
        applyUiAppearanceOverrides(uiAppearanceOverrides);
      });
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [colorTheme, themeMode, uiAppearanceOverrides]);

  return null;
}

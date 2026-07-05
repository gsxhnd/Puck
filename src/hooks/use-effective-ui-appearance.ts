import { useLayoutEffect, useState } from "react";
import {
  readUiAppearanceFromDom,
  resolveUiAppearance,
} from "@/lib/ui-appearance-css";
import { DEFAULT_UI_APPEARANCE } from "@/types/ui-appearance";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import type { UiAppearance } from "@/types/ui-appearance";

/**
 * Resolves UI chrome for settings UI: active color theme + user overrides.
 *
 * 合并当前配色主题与用户覆盖项，供设置页展示实际生效的界面样式值。
 */
export function useEffectiveUiAppearance(): UiAppearance {
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);
  const overrides = useAppSettingsStore((state) => state.uiAppearanceOverrides);
  const [themeAppearance, setThemeAppearance] =
    useState<UiAppearance>(DEFAULT_UI_APPEARANCE);

  useLayoutEffect(() => {
    setThemeAppearance(readUiAppearanceFromDom());
  }, [colorTheme, overrides]);

  return resolveUiAppearance(overrides, themeAppearance);
}

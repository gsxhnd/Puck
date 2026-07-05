import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { THEME_MODES } from "@/page/settings/settings-constants";
import type { ColorThemeId } from "@/lib/color-themes";
import type { ThemeMode } from "@/types/settings";
import { DEFAULT_TERMINAL_FONT_FAMILY } from "@/types/settings";
import {
  DEFAULT_UI_FONT_FAMILY,
  UI_BORDER_RADIUS_PRESETS,
  UI_SHELL_LAYERING_PRESETS,
  UI_WINDOW_RADIUS_PRESETS,
  type UiBorderRadiusPreset,
  type UiShellLayeringPreset,
  type UiWindowRadiusPreset,
} from "@/types/ui-appearance";
import { useEffectiveUiAppearance } from "@/hooks/use-effective-ui-appearance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SettingsCombobox,
  SettingsRow,
  SettingsSelect,
} from "@/page/settings/settings-primitives";
import {
  getAvailableColorThemes,
  refreshColorThemeRegistry,
} from "@/lib/color-theme-registry";
import { formatColorThemeDisplayName } from "@/lib/color-theme-display-name";

/**
 * Appearance settings: color theme, light/dark mode, UI chrome, and terminal font.
 *
 * 「外观」设置区段：应用配色主题、明暗模式、界面样式（圆角、字体、侧栏层次），
 * 以及终端字体族与字号。
 */
export function AppearanceSettingsSection() {
  const { t, i18n } = useTranslation(["settings", "common"]);
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const uiAppearance = useEffectiveUiAppearance();
  const hasUiAppearanceOverrides = useAppSettingsStore(
    (state) => Object.keys(state.uiAppearanceOverrides).length > 0,
  );
  const fontFamily = useAppSettingsStore((state) => state.fontFamily);
  const fontSize = useAppSettingsStore((state) => state.fontSize);
  const setColorTheme = useAppSettingsStore((state) => state.setColorTheme);
  const setThemeMode = useAppSettingsStore((state) => state.setThemeMode);
  const setUiAppearance = useAppSettingsStore((state) => state.setUiAppearance);
  const clearUiAppearanceOverrides = useAppSettingsStore(
    (state) => state.clearUiAppearanceOverrides,
  );
  const setFontFamily = useAppSettingsStore((state) => state.setFontFamily);
  const setFontSize = useAppSettingsStore((state) => state.setFontSize);
  const [, setRegistryTick] = useState(0);

  useEffect(() => {
    void refreshColorThemeRegistry().then(() => {
      setRegistryTick((value) => value + 1);
    });
  }, []);

  const availableThemes = getAvailableColorThemes();

  const themeModeLabels = Object.fromEntries(
    THEME_MODES.map((item) => [item, t(`common:theme.${item}`)]),
  ) as Record<ThemeMode, string>;

  const colorThemeOptions = useMemo(
    () => availableThemes.map((theme) => theme.id),
    [availableThemes],
  );

  const colorThemeLabels = useMemo(() => {
    return Object.fromEntries(
      availableThemes.map((theme) => [
        theme.id,
        formatColorThemeDisplayName(theme.id, i18n.language),
      ]),
    ) as Record<ColorThemeId, string>;
  }, [availableThemes, i18n.language]);

  const borderRadiusLabels = Object.fromEntries(
    UI_BORDER_RADIUS_PRESETS.map((value) => [
      value,
      t(`settings:appearance.borderRadiusOptions.${value}`),
    ]),
  ) as Record<UiBorderRadiusPreset, string>;

  const windowRadiusLabels = Object.fromEntries(
    UI_WINDOW_RADIUS_PRESETS.map((value) => [
      String(value),
      t(`settings:appearance.windowRadiusOptions.${value}`),
    ]),
  ) as Record<string, string>;

  const shellLayeringLabels = Object.fromEntries(
    UI_SHELL_LAYERING_PRESETS.map((value) => [
      value,
      t(`settings:appearance.shellLayeringOptions.${value}`),
    ]),
  ) as Record<UiShellLayeringPreset, string>;

  return (
    <section>
      <h2 className="text-base font-semibold">
        {t("settings:sections.appearance")}
      </h2>
      <div className="mt-2 divide-y rounded-xl border bg-card px-4">
        <SettingsRow
          title={t("settings:appearance.colorTheme")}
          description={t("settings:appearance.colorThemeDescription")}
        >
          <SettingsCombobox
            value={colorTheme}
            options={colorThemeOptions}
            labels={colorThemeLabels}
            onChange={setColorTheme}
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow
          title={t("settings:appearance.themeMode")}
          description={t("settings:appearance.themeModeDescription")}
        >
          <SettingsSelect
            value={themeMode}
            options={THEME_MODES}
            labels={themeModeLabels}
            onChange={setThemeMode}
          />
        </SettingsRow>
        <SettingsRow
          title={t("settings:appearance.uiFontFamily")}
          description={t("settings:appearance.uiFontFamilyDescription")}
        >
          <Input
            value={uiAppearance.uiFontFamily}
            onChange={(event) =>
              setUiAppearance({ uiFontFamily: event.target.value })
            }
            placeholder={DEFAULT_UI_FONT_FAMILY}
            className="w-56 font-mono text-xs"
          />
        </SettingsRow>
        <SettingsRow
          title={t("settings:appearance.borderRadius")}
          description={t("settings:appearance.borderRadiusDescription")}
        >
          <SettingsSelect
            value={uiAppearance.borderRadius}
            options={[...UI_BORDER_RADIUS_PRESETS]}
            labels={borderRadiusLabels}
            onChange={(value) =>
              setUiAppearance({ borderRadius: value as UiBorderRadiusPreset })
            }
          />
        </SettingsRow>
        <SettingsRow
          title={t("settings:appearance.windowRadius")}
          description={t("settings:appearance.windowRadiusDescription")}
        >
          <SettingsSelect
            value={String(uiAppearance.windowRadius)}
            options={UI_WINDOW_RADIUS_PRESETS.map(String)}
            labels={windowRadiusLabels}
            onChange={(value) =>
              setUiAppearance({
                windowRadius: Number(value) as UiWindowRadiusPreset,
              })
            }
          />
        </SettingsRow>
        <SettingsRow
          title={t("settings:appearance.shellLayering")}
          description={t("settings:appearance.shellLayeringDescription")}
        >
          <SettingsSelect
            value={uiAppearance.shellLayering}
            options={[...UI_SHELL_LAYERING_PRESETS]}
            labels={shellLayeringLabels}
            onChange={(value) =>
              setUiAppearance({
                shellLayering: value as UiShellLayeringPreset,
              })
            }
          />
        </SettingsRow>
        <SettingsRow
          title={t("settings:appearance.terminalPadding")}
          description={t("settings:appearance.terminalPaddingDescription")}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={24}
              value={uiAppearance.terminalPaddingY}
              onChange={(event) =>
                setUiAppearance({
                  terminalPaddingY: Number(event.target.value),
                })
              }
              className="w-16"
              aria-label={t("settings:appearance.terminalPaddingY")}
            />
            <span className="text-xs text-muted-foreground">×</span>
            <Input
              type="number"
              min={0}
              max={24}
              value={uiAppearance.terminalPaddingX}
              onChange={(event) =>
                setUiAppearance({
                  terminalPaddingX: Number(event.target.value),
                })
              }
              className="w-16"
              aria-label={t("settings:appearance.terminalPaddingX")}
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </SettingsRow>
        {hasUiAppearanceOverrides ? (
          <SettingsRow
            title={t("settings:appearance.resetUiAppearance")}
            description={t("settings:appearance.resetUiAppearanceDescription")}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearUiAppearanceOverrides}
            >
              {t("settings:appearance.resetUiAppearanceAction")}
            </Button>
          </SettingsRow>
        ) : null}
        <SettingsRow title={t("settings:appearance.fontFamily")}>
          <Input
            value={fontFamily}
            onChange={(event) => setFontFamily(event.target.value)}
            placeholder={DEFAULT_TERMINAL_FONT_FAMILY}
            className="w-56 font-mono text-xs"
          />
        </SettingsRow>
        <SettingsRow title={t("settings:appearance.fontSize")}>
          <Input
            type="number"
            min={10}
            max={24}
            value={fontSize}
            onChange={(event) =>
              setFontSize(Number(event.target.value) || 14)
            }
            className="w-20"
          />
        </SettingsRow>
      </div>
    </section>
  );
}

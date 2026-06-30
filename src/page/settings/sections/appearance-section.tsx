import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { THEME_MODES } from "@/page/settings/settings-constants";
import type { ColorThemeId } from "@/lib/color-themes";
import type { ThemeMode } from "@/types/settings";
import { DEFAULT_TERMINAL_FONT_FAMILY } from "@/types/settings";
import { Input } from "@/components/ui/input";
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
 * Appearance settings: color theme, light/dark mode, terminal font.
 *
 * 「外观」设置区段：应用配色主题、明暗模式，以及终端字体族与字号。
 */
export function AppearanceSettingsSection() {
  const { t, i18n } = useTranslation(["settings", "common"]);
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const fontFamily = useAppSettingsStore((state) => state.fontFamily);
  const fontSize = useAppSettingsStore((state) => state.fontSize);
  const setColorTheme = useAppSettingsStore((state) => state.setColorTheme);
  const setThemeMode = useAppSettingsStore((state) => state.setThemeMode);
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

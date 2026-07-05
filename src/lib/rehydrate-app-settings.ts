import i18n from "@/i18n";
import { applyUiTheme } from "@/lib/apply-ui-theme";
import { applyUiAppearanceOverrides } from "@/lib/apply-ui-appearance";
import {
  PUCK_CONFIG_KEYS,
  reloadPuckConfigKey,
} from "@/lib/puck-config-storage";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useShellUiStore } from "@/stores/shell-ui-store";

/** Reload app settings from disk and apply theme, language, and shell UI state. */
export async function rehydrateAppSettings(): Promise<void> {
  await reloadPuckConfigKey(PUCK_CONFIG_KEYS.appSettings);
  await useAppSettingsStore.persist.rehydrate();
  const {
    language,
    themeMode,
    colorTheme,
    uiAppearanceOverrides,
    primaryPanelOpen,
    secondPanelOpen,
  } = useAppSettingsStore.getState();
  await applyUiTheme(themeMode, colorTheme);
  applyUiAppearanceOverrides(uiAppearanceOverrides);
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
  useShellUiStore.getState().setPrimaryPanelOpen(primaryPanelOpen);
  useShellUiStore.getState().setSecondPanelOpen(secondPanelOpen);
}

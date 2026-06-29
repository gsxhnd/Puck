import i18n from "@/i18n";
import { applyUiTheme } from "@/lib/apply-ui-theme";
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
  const { language, themeMode, colorTheme, primaryPanelOpen, secondPanelOpen } =
    useAppSettingsStore.getState();
  applyUiTheme(themeMode, colorTheme);
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
  useShellUiStore.getState().setPrimaryPanelOpen(primaryPanelOpen);
  useShellUiStore.getState().setSecondPanelOpen(secondPanelOpen);
}

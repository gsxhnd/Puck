/**
 * Reloads persisted app settings and reapplies theme and language.
 *
 * 从磁盘重新加载应用设置，并立即应用主题、外观覆盖与语言。Workspace 布局由
 * `workspaces` 配置区段独立持久化，不跟随本设置区段。
 */
import i18n from "@/i18n";
import { applyUiTheme } from "@/lib/apply-ui-theme";
import { applyUiAppearanceOverrides } from "@/lib/apply-ui-appearance";
import {
  PUCK_CONFIG_KEYS,
  reloadPuckConfigKey,
} from "@/lib/puck-config-storage";
import { useAppSettingsStore } from "@/stores/app-settings-store";

export async function rehydrateAppSettings(): Promise<void> {
  await reloadPuckConfigKey(PUCK_CONFIG_KEYS.appSettings);
  await useAppSettingsStore.persist.rehydrate();
  const { language, themeMode, colorTheme, uiAppearanceOverrides } =
    useAppSettingsStore.getState();
  await applyUiTheme(themeMode, colorTheme);
  applyUiAppearanceOverrides(uiAppearanceOverrides);
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
}

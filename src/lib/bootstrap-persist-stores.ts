import i18n from "@/i18n";
import { applyUiTheme } from "@/lib/apply-ui-theme";
import { initPuckConfigStorage } from "@/lib/puck-config-storage";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionPrivilegesStore } from "@/stores/session-privileges-store";
import { useSidebarLayoutStore } from "@/stores/sidebar-layout-store";

/** Hydrate all persisted stores after config.toml has been preloaded. */
export async function bootstrapPersistStores(): Promise<void> {
  await initPuckConfigStorage();

  await Promise.all([
    useAppSettingsStore.persist.rehydrate(),
    useConnectionStore.persist.rehydrate(),
    useSidebarLayoutStore.persist.rehydrate(),
    useSessionPrivilegesStore.persist.rehydrate(),
  ]);

  const { language, themeMode, colorTheme } = useAppSettingsStore.getState();
  applyUiTheme(themeMode, colorTheme);
  if (language && i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
}

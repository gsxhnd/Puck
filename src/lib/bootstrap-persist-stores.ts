import i18n from "@/i18n";
import { applyUiTheme } from "@/lib/apply-ui-theme";
import { initColorThemeRegistry } from "@/lib/color-theme-registry";
import { initConnectionPersistStorage } from "@/lib/connection-persist-storage";
import { initPuckConfigStorage } from "@/lib/puck-config-storage";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionPrivilegesStore } from "@/stores/session-privileges-store";
import { useHostsLayoutStore } from "@/stores/hosts-layout-store";
import { useSidebarLayoutStore } from "@/stores/sidebar-layout-store";

/** Hydrate all persisted stores after on-disk config has been preloaded. */
export async function bootstrapPersistStores(): Promise<void> {
  await Promise.all([
    initPuckConfigStorage(),
    initConnectionPersistStorage(),
  ]);
  await initColorThemeRegistry();

  await Promise.all([
    useAppSettingsStore.persist.rehydrate(),
    useConnectionStore.persist.rehydrate(),
    useSidebarLayoutStore.persist.rehydrate(),
    useHostsLayoutStore.persist.rehydrate(),
    useSessionPrivilegesStore.persist.rehydrate(),
  ]);

  const { language, themeMode, colorTheme } = useAppSettingsStore.getState();
  await applyUiTheme(themeMode, colorTheme);
  if (language && i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
}

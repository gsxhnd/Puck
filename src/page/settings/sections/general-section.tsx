import { useTranslation } from "react-i18next";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { LANGUAGES } from "@/page/settings/settings-constants";
import type { AppLanguage } from "@/types/settings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  SettingsCombobox,
  SettingsRow,
} from "@/page/settings/settings-primitives";

/**
 * General settings: language, startup behavior, and reset.
 *
 * 「通用」设置区段：界面语言、启动时打开本地终端，以及一键恢复默认设置。
 * Workspace 侧栏与终端布局由主窗口实时状态持久化，不在此重复配置。
 */
export function GeneralSettingsSection() {
  const { t } = useTranslation(["settings", "common"]);
  const language = useAppSettingsStore((state) => state.language);
  const openLocalOnStart = useAppSettingsStore(
    (state) => state.openLocalTerminalOnStart,
  );
  const setLanguage = useAppSettingsStore((state) => state.setLanguage);
  const setOpenLocalOnStart = useAppSettingsStore(
    (state) => state.setOpenLocalTerminalOnStart,
  );
  const resetSettings = useAppSettingsStore((state) => state.reset);

  const languageLabels = Object.fromEntries(
    LANGUAGES.map((lng) => [lng, lng === "zh-CN" ? "中文" : "English"]),
  ) as Record<AppLanguage, string>;

  return (
    <section>
      <h2 className="text-base font-semibold">
        {t("settings:sections.general")}
      </h2>
      <div className="mt-2 divide-y rounded-xl border bg-card px-4">
        <SettingsRow
          title={t("settings:general.language")}
          description={t("settings:general.languageDescription")}
        >
          <SettingsCombobox
            value={language}
            options={LANGUAGES}
            labels={languageLabels}
            onChange={setLanguage}
          />
        </SettingsRow>
        <SettingsRow
          title={t("settings:general.openLocalOnStart")}
          description={t("settings:general.openLocalOnStartDescription")}
        >
          <Switch
            checked={openLocalOnStart}
            onCheckedChange={setOpenLocalOnStart}
          />
        </SettingsRow>
        <SettingsRow
          title={t("settings:general.resetSettings")}
          description={t("settings:general.resetSettingsDescription")}
        >
          <Button variant="outline" size="sm" onClick={resetSettings}>
            {t("settings:general.resetSettingsAction")}
          </Button>
        </SettingsRow>
      </div>
    </section>
  );
}

import { useTranslation } from "react-i18next";
import { useAppVersion } from "@/lib/use-app-version";
import { openConnectionsWindow } from "@/lib/open-connections-window";
import { Button } from "@/components/ui/button";

/**
 * About section: app name, version, and link to connection manager.
 *
 * 「关于」设置区段：展示应用名称、简介、当前版本号，并提供跳转到连接管理
 * 窗口的入口。
 */
export function AboutSettingsSection() {
  const { t } = useTranslation(["settings", "common"]);
  const appVersion = useAppVersion();

  return (
    <section>
      <h2 className="text-base font-semibold">
        {t("settings:sections.about")}
      </h2>
      <div className="mt-2 space-y-4 rounded-xl border bg-card px-4 py-4 text-sm text-muted-foreground">
        <div>
          <div className="font-medium text-foreground">
            {t("common:app.name")}
          </div>
          <p className="mt-1">{t("settings:about.description")}</p>
          <p className="mt-3">
            {t("settings:about.version")}: {appVersion}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void openConnectionsWindow()}
        >
          {t("settings:about.manageConnections")}
        </Button>
      </div>
    </section>
  );
}

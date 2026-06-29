import { useTranslation } from "react-i18next";
import { SettingsCredentials } from "@/page/settings/settings-credentials";
import { SettingsKnownHosts } from "@/page/settings/settings-known-hosts";

/**
 * Connection-related settings: stored credentials and SSH host keys.
 *
 * 「连接」设置区段：托管在系统钥匙串中的凭据管理，以及已信任的 SSH
 * 主机公钥列表。具体 UI 委托给已有的子页面组件。
 */
export function ConnectionsSettingsSection() {
  const { t } = useTranslation("settings");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">
          {t("settings:connections.credentials")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings:connections.credentialsDescription")}
        </p>
        <div className="mt-2 rounded-xl border bg-card px-4">
          <SettingsCredentials />
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold">
          {t("settings:connections.hostKeys")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings:connections.hostKeysDescription")}
        </p>
        <div className="mt-2 rounded-xl border bg-card px-4">
          <SettingsKnownHosts />
        </div>
      </div>
    </section>
  );
}

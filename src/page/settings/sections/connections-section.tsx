import { useTranslation } from "react-i18next";
import { SettingsKnownHosts } from "@/page/settings/settings-known-hosts";

/**
 * Connection-related settings: trusted SSH host keys.
 *
 * 「连接」设置区段：已信任的 SSH 主机公钥列表。
 */
export function ConnectionsSettingsSection() {
  const { t } = useTranslation("settings");

  return (
    <section>
      <h2 className="text-base font-semibold">
        {t("settings:connections.hostKeys")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settings:connections.hostKeysDescription")}
      </p>
      <div className="mt-2 rounded-xl border bg-card px-4">
        <SettingsKnownHosts />
      </div>
    </section>
  );
}

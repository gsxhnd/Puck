import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import {
  SYSTEM_RESOURCE_METRIC_ITEMS,
  SYSTEM_RESOURCE_POLL_INTERVAL_OPTIONS,
} from "@/page/settings/settings-constants";
import type { SystemResourcePollIntervalMs } from "@/types/settings";
import { Switch } from "@/components/ui/switch";
import {
  SettingsRow,
  SettingsSelect,
} from "@/page/settings/settings-primitives";

type PollIntervalOption = `${SystemResourcePollIntervalMs}`;

function toPollIntervalOption(
  intervalMs: SystemResourcePollIntervalMs,
): PollIntervalOption {
  return String(intervalMs) as PollIntervalOption;
}

function fromPollIntervalOption(option: PollIntervalOption): SystemResourcePollIntervalMs {
  return Number(option) as SystemResourcePollIntervalMs;
}

/**
 * System resource monitoring settings: poll intervals and metric toggles.
 *
 * 「系统资源」设置区段：本机与远程采集频率，以及 CPU、内存等指标显示开关。
 */
export function SystemResourcesSettingsSection() {
  const { t } = useTranslation("settings");
  const localPollIntervalMs = useAppSettingsStore(
    (state) => state.systemResourcesLocalPollIntervalMs,
  );
  const remotePollIntervalMs = useAppSettingsStore(
    (state) => state.systemResourcesRemotePollIntervalMs,
  );
  const metrics = useAppSettingsStore((state) => state.systemResourcesMetrics);
  const setLocalPollIntervalMs = useAppSettingsStore(
    (state) => state.setSystemResourcesLocalPollIntervalMs,
  );
  const setRemotePollIntervalMs = useAppSettingsStore(
    (state) => state.setSystemResourcesRemotePollIntervalMs,
  );
  const setMetric = useAppSettingsStore((state) => state.setSystemResourceMetric);

  const pollIntervalLabels = useMemo(
    () =>
      Object.fromEntries(
        SYSTEM_RESOURCE_POLL_INTERVAL_OPTIONS.map((intervalMs) => [
          toPollIntervalOption(intervalMs),
          t("settings:systemResources.pollIntervalOption", {
            seconds: intervalMs / 1000,
          }),
        ]),
      ) as Record<PollIntervalOption, string>,
    [t],
  );

  const pollIntervalOptions = useMemo(
    () => SYSTEM_RESOURCE_POLL_INTERVAL_OPTIONS.map(toPollIntervalOption),
    [],
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">
          {t("settings:sections.systemResources")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings:systemResources.description")}
        </p>
        <div className="mt-2 divide-y rounded-xl border bg-card px-4">
          <SettingsRow
            title={t("settings:systemResources.localPollInterval")}
            description={t("settings:systemResources.localPollIntervalDescription")}
          >
            <SettingsSelect
              value={toPollIntervalOption(localPollIntervalMs)}
              options={pollIntervalOptions}
              labels={pollIntervalLabels}
              onChange={(value) =>
                setLocalPollIntervalMs(fromPollIntervalOption(value))
              }
            />
          </SettingsRow>
          <SettingsRow
            title={t("settings:systemResources.remotePollInterval")}
            description={t("settings:systemResources.remotePollIntervalDescription")}
          >
            <SettingsSelect
              value={toPollIntervalOption(remotePollIntervalMs)}
              options={pollIntervalOptions}
              labels={pollIntervalLabels}
              onChange={(value) =>
                setRemotePollIntervalMs(fromPollIntervalOption(value))
              }
            />
          </SettingsRow>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">
          {t("settings:systemResources.metricsTitle")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings:systemResources.metricsDescription")}
        </p>
        <div className="mt-2 divide-y rounded-xl border bg-card px-4">
          {SYSTEM_RESOURCE_METRIC_ITEMS.map((item) => (
            <SettingsRow key={item.key} title={t(item.labelKey)}>
              <Switch
                checked={metrics[item.key]}
                onCheckedChange={(enabled) => setMetric(item.key, enabled)}
              />
            </SettingsRow>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CpuIcon, HardDriveIcon, MemoryStickIcon } from "lucide-react";
import { parsePuckError } from "@/lib/puck-error";
import { isTauri } from "@/lib/platform";
import {
  getRemoteSystemStats,
  getSystemStats,
  type SystemStats,
} from "@/lib/tauri-system";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import type { SystemResourceMetrics } from "@/types/settings";
import { cn } from "@/lib/utils";

export type SystemResourcesScope = {
  source: "local" | "remote";
  sessionId?: string;
  remoteLabel?: string;
  sessionConnected?: boolean;
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function ResourceMeter({
  label,
  valueLabel,
  percent,
  icon: Icon,
}: {
  label: string;
  valueLabel: string;
  percent: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className="space-y-1.5 rounded-md px-2 py-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3 shrink-0 opacity-70" />
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 font-mono text-foreground/90">{valueLabel}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            clamped >= 90 ? "bg-destructive/80" : "bg-primary/70",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function SystemResourcesContent({
  stats,
  metrics,
}: {
  stats: SystemStats;
  metrics: SystemResourceMetrics;
}) {
  const { t } = useTranslation("info");

  const memoryPercent =
    stats.memoryTotal > 0
      ? (stats.memoryUsed / stats.memoryTotal) * 100
      : 0;

  const disk = stats.primaryDisk;
  const diskUsed = disk ? disk.totalBytes - disk.availableBytes : 0;
  const diskPercent =
    disk && disk.totalBytes > 0 ? (diskUsed / disk.totalBytes) * 100 : 0;

  return (
    <div className="space-y-1">
      {metrics.cpu ? (
        <ResourceMeter
          icon={CpuIcon}
          label={t("cpu")}
          valueLabel={formatPercent(stats.cpuUsage)}
          percent={stats.cpuUsage}
        />
      ) : null}
      {metrics.memory ? (
        <ResourceMeter
          icon={MemoryStickIcon}
          label={t("memory")}
          valueLabel={`${formatBytes(stats.memoryUsed)} / ${formatBytes(stats.memoryTotal)}`}
          percent={memoryPercent}
        />
      ) : null}
      {metrics.disk && disk ? (
        <ResourceMeter
          icon={HardDriveIcon}
          label={disk.mountPoint || t("disk")}
          valueLabel={`${formatBytes(diskUsed)} / ${formatBytes(disk.totalBytes)}`}
          percent={diskPercent}
        />
      ) : null}
      {metrics.loadAverage && stats.loadAverage ? (
        <div className="px-2 pt-1 text-[10px] text-muted-foreground">
          {t("loadAverage", {
            one: stats.loadAverage[0].toFixed(2),
            five: stats.loadAverage[1].toFixed(2),
            fifteen: stats.loadAverage[2].toFixed(2),
          })}
        </div>
      ) : null}
      {metrics.swap && stats.swapTotal > 0 ? (
        <div className="px-2 text-[10px] text-muted-foreground">
          {t("swapUsage", {
            used: formatBytes(stats.swapUsed),
            total: formatBytes(stats.swapTotal),
          })}
        </div>
      ) : null}
    </div>
  );
}

export function SystemResourcesSection({
  active,
  scope,
}: {
  active: boolean;
  scope: SystemResourcesScope;
}) {
  const { t } = useTranslation("info");
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localPollIntervalMs = useAppSettingsStore(
    (state) => state.systemResourcesLocalPollIntervalMs,
  );
  const remotePollIntervalMs = useAppSettingsStore(
    (state) => state.systemResourcesRemotePollIntervalMs,
  );
  const metrics = useAppSettingsStore((state) => state.systemResourcesMetrics);

  const isRemote = scope.source === "remote";
  const canPollRemote = isRemote && scope.sessionConnected && Boolean(scope.sessionId);
  const hasEnabledMetrics = Object.values(metrics).some(Boolean);
  const canPoll =
    active && isTauri() && hasEnabledMetrics && (!isRemote || canPollRemote);

  useEffect(() => {
    if (!canPoll) {
      setStats(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const next =
          isRemote && scope.sessionId
            ? await getRemoteSystemStats(scope.sessionId)
            : await getSystemStats();
        if (cancelled) return;
        setStats(next);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(parsePuckError(err).message);
      }
    };

    void poll();
    const intervalMs = isRemote ? remotePollIntervalMs : localPollIntervalMs;
    const intervalId = window.setInterval(() => void poll(), intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    canPoll,
    isRemote,
    localPollIntervalMs,
    remotePollIntervalMs,
    scope.sessionId,
  ]);

  const scopeLabel = isRemote
    ? t("systemResourcesRemote", {
        host: scope.remoteLabel ?? t("systemResourcesRemoteHost"),
      })
    : t("systemResourcesLocal");

  if (!isTauri()) {
    return (
      <p className="px-2 text-xs text-muted-foreground">{t("systemResourcesDesktopOnly")}</p>
    );
  }

  if (isRemote && !scope.sessionConnected) {
    return (
      <div className="space-y-1">
        <p className="px-2 text-[10px] text-muted-foreground">{scopeLabel}</p>
        <p className="px-2 text-xs text-muted-foreground">
          {t("systemResourcesSessionDisconnected")}
        </p>
      </div>
    );
  }

  if (!hasEnabledMetrics) {
    return (
      <div className="space-y-1">
        <p className="px-2 text-[10px] text-muted-foreground">{scopeLabel}</p>
        <p className="px-2 text-xs text-muted-foreground">
          {t("systemResourcesMetricsDisabled")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="px-2 text-[10px] text-muted-foreground">{scopeLabel}</p>
      {error ? (
        <p className="px-2 text-xs text-destructive">{error}</p>
      ) : !stats ? (
        <p className="px-2 text-xs text-muted-foreground">{t("systemResourcesLoading")}</p>
      ) : (
        <SystemResourcesContent stats={stats} metrics={metrics} />
      )}
    </div>
  );
}

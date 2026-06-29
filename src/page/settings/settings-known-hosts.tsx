import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2Icon } from "lucide-react";
import { deleteKnownHost, listKnownHosts, type KnownHostRecord } from "@/lib/tauri-ssh";
import { isTauri } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function SettingsKnownHosts() {
  const { t } = useTranslation(["settings", "common"]);
  const [hosts, setHosts] = useState<KnownHostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const loadHosts = useCallback(async () => {
    if (!isTauri()) {
      setHosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setHosts(await listKnownHosts());
    } catch {
      setHosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHosts();
  }, [loadHosts]);

  const handleRemove = async (host: KnownHostRecord) => {
    const key = `${host.host}:${host.port}`;
    setRemovingKey(key);
    try {
      await deleteKnownHost(host.host, host.port);
      setHosts((current) =>
        current.filter(
          (item) => !(item.host === host.host && item.port === host.port),
        ),
      );
    } finally {
      setRemovingKey(null);
    }
  };

  if (!isTauri()) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        {t("settings:connections.hostKeysDesktopOnly")}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (hosts.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        {t("settings:connections.hostKeysEmpty")}
      </p>
    );
  }

  return (
    <div className="divide-y">
      {hosts.map((host) => {
        const key = `${host.host}:${host.port}`;
        return (
          <div
            key={key}
            className="flex items-start justify-between gap-4 py-3"
          >
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-medium">
                {host.host}:{host.port}
              </div>
              <div className="truncate font-mono text-xs text-muted-foreground">
                {host.fingerprint}
              </div>
              <div className="text-xs text-muted-foreground">{host.keyType}</div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("common:actions.delete")}
              disabled={removingKey === key}
              onClick={() => void handleRemove(host)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

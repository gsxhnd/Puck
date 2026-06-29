import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useConnectionStore } from "@/stores/connection-store";
import { hasCredential } from "@/lib/tauri-ssh";
import { openConnectionsWindow } from "@/lib/open-connections-window";
import { isTauri } from "@/lib/platform";
import type { ConnectionProfile } from "@/types/connection";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type CredentialStatus = {
  password: boolean;
  passphrase: boolean;
};

function credentialFieldsForProfile(
  profile: ConnectionProfile,
): Array<"password" | "passphrase"> {
  const fields: Array<"password" | "passphrase"> = [];
  if (profile.authMethod === "password") {
    fields.push("password");
  }
  if (profile.authMethod === "privateKey") {
    fields.push("passphrase");
  }
  return fields;
}

export function SettingsCredentials() {
  const { t } = useTranslation(["settings", "common"]);
  const profiles = useConnectionStore((state) =>
    state.profiles.filter(
      (profile) => profile.protocol !== "local" && !profile.ephemeral,
    ),
  );
  const [statusById, setStatusById] = useState<Record<string, CredentialStatus>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  const loadStatuses = useCallback(async () => {
    if (!isTauri()) {
      setStatusById({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const entries = await Promise.all(
        profiles.map(async (profile) => {
          const fields = credentialFieldsForProfile(profile);
          const [password, passphrase] = await Promise.all([
            fields.includes("password")
              ? hasCredential(profile.id, "password")
              : Promise.resolve(false),
            fields.includes("passphrase")
              ? hasCredential(profile.id, "passphrase")
              : Promise.resolve(false),
          ]);
          return [profile.id, { password, passphrase }] as const;
        }),
      );
      setStatusById(Object.fromEntries(entries));
    } finally {
      setLoading(false);
    }
  }, [profiles]);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  if (!isTauri()) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        {t("settings:connections.credentialsDesktopOnly")}
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

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col gap-3 py-4">
        <p className="text-sm text-muted-foreground">
          {t("settings:connections.credentialsEmpty")}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => void openConnectionsWindow()}
        >
          {t("settings:connections.manageConnections")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      <div className="divide-y rounded-lg border">
        {profiles.map((profile) => {
          const status = statusById[profile.id];
          const fields = credentialFieldsForProfile(profile);
          return (
            <div
              key={profile.id}
              className="flex items-start justify-between gap-4 px-3 py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium">{profile.name}</div>
                <div className="text-xs text-muted-foreground">
                  {profile.host}:{profile.port ?? 22}
                </div>
                {fields.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {fields.map((field) => (
                      <span
                        key={field}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {t(`settings:connections.credentialFields.${field}`)}:{" "}
                        {status?.[field]
                          ? t("settings:connections.credentialStored")
                          : t("settings:connections.credentialMissing")}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {t("settings:connections.noCredentialsRequired")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void openConnectionsWindow()}
      >
        {t("settings:connections.manageConnections")}
      </Button>
    </div>
  );
}

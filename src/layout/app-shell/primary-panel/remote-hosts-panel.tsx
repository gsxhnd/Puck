import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useConnectionStore } from "@/stores/connection-store";
import type { ConnectionProfile } from "@/types/connection";
import { requestOpenConnectionProfile } from "@/lib/connection-bridge";
import { deleteConnectionCredentials } from "@/lib/tauri-ssh";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

function profileSubtitle(profile: ConnectionProfile): string {
  const user = profile.username || "user";
  const host = profile.host || "host";
  const port = profile.port ? `:${profile.port}` : "";
  return `${user}@${host}${port}`;
}

function RemoteHostItem({
  profile,
  onEdit,
  onDelete,
  onConnect,
}: {
  profile: ConnectionProfile;
  onEdit: () => void;
  onDelete: () => void;
  onConnect: () => void;
}) {
  const { t } = useTranslation(["connections", "common"]);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            onClick={onConnect}
            className={cn(
              "flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors",
              "hover:bg-muted/50",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "shrink-0 rounded px-1 py-0.5 font-mono text-[10px] uppercase",
                  "bg-muted text-muted-foreground",
                )}
              >
                {t(`common:protocol.${profile.protocol}`)}
              </span>
              <span className="min-w-0 truncate text-sm font-medium">
                {profile.name}
              </span>
            </div>
            <span className="truncate pl-0.5 text-xs text-muted-foreground">
              {profileSubtitle(profile)}
            </span>
          </button>
        }
      />
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={onConnect}>
          {t("connections:manager.connect")}
        </ContextMenuItem>
        <ContextMenuItem onClick={onEdit}>
          {t("common:actions.edit")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          {t("common:actions.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function RemoteHostsPanel({
  onEditProfile,
}: {
  onEditProfile: (profileId: string) => void;
}) {
  const { t } = useTranslation(["connections", "common"]);
  const profiles = useConnectionStore((state) => state.profiles);
  const removeProfile = useConnectionStore((state) => state.removeProfile);

  const sortedProfiles = useMemo(
    () =>
      [...profiles]
        .filter((profile) => profile.protocol !== "local" && !profile.ephemeral)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        ),
    [profiles],
  );

  const handleDelete = async (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    if (!window.confirm(t("connections:manager.deleteConfirm"))) return;
    await deleteConnectionCredentials(profileId);
    removeProfile(profileId);
  };

  const handleConnect = (profileId: string) => {
    void requestOpenConnectionProfile(profileId);
  };

  if (sortedProfiles.length === 0) {
    return (
      <div className="px-2 py-6 text-center text-xs text-muted-foreground">
        {t("connections:manager.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-0.5 pb-2">
      {sortedProfiles.map((profile) => (
        <RemoteHostItem
          key={profile.id}
          profile={profile}
          onEdit={() => onEditProfile(profile.id)}
          onDelete={() => void handleDelete(profile.id)}
          onConnect={() => handleConnect(profile.id)}
        />
      ))}
    </div>
  );
}

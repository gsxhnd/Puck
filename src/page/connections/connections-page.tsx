import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PencilIcon,
  PlugIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { ConnectionDialog } from "@/components/connections/connection-dialog";
import { useConnectionStore } from "@/stores/connection-store";
import type { ConnectionProfile } from "@/types/connection";
import { requestOpenConnectionProfile } from "@/lib/connection-bridge";
import { deleteConnectionCredentials } from "@/lib/tauri-ssh";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function profileSubtitle(
  profile: ConnectionProfile,
  t: (key: string) => string,
): string {
  if (profile.protocol === "local") {
    return t("common:protocol.local");
  }

  const user = profile.username || "user";
  const host = profile.host || "host";
  const port = profile.port ? `:${profile.port}` : "";
  return `${user}@${host}${port}`;
}

function ConnectionRow({
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
  const isLocal = profile.protocol === "local";

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{profile.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono uppercase",
              "bg-muted text-muted-foreground",
            )}
          >
            {t(`common:protocol.${profile.protocol}`)}
          </span>
          <span className="truncate">{profileSubtitle(profile, t)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onConnect}
        >
          <PlugIcon />
          {t("connections:manager.connect")}
        </Button>
        {!isLocal ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("common:actions.edit")}
              onClick={onEdit}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("common:actions.delete")}
              onClick={onDelete}
            >
              <Trash2Icon />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ConnectionsPage() {
  const { t } = useTranslation(["connections", "common"]);
  const profiles = useConnectionStore((state) => state.profiles);
  const removeProfile = useConnectionStore((state) => state.removeProfile);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const sortedProfiles = useMemo(
    () =>
      [...profiles].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [profiles],
  );

  const openCreateDialog = () => {
    setEditingProfileId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (profileId: string) => {
    setEditingProfileId(profileId);
    setDialogOpen(true);
  };

  const handleDelete = async (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile || profile.protocol === "local") return;
    if (!window.confirm(t("connections:manager.deleteConfirm"))) return;
    await deleteConnectionCredentials(profileId);
    removeProfile(profileId);
  };

  const handleConnect = (profileId: string) => {
    void requestOpenConnectionProfile(profileId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-base font-semibold">
            {t("connections:manager.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("connections:manager.description")}
          </p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <PlusIcon />
          {t("common:actions.newConnection")}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-6">
          {sortedProfiles.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              {t("connections:manager.empty")}
            </div>
          ) : (
            sortedProfiles.map((profile) => (
              <ConnectionRow
                key={profile.id}
                profile={profile}
                onEdit={() => openEditDialog(profile.id)}
                onDelete={() => void handleDelete(profile.id)}
                onConnect={() => handleConnect(profile.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <ConnectionDialog
        open={dialogOpen}
        profileId={editingProfileId}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

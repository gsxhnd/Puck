import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  CopyIcon,
  FolderIcon,
  PencilIcon,
  PlugIcon,
} from "lucide-react";
import type { ConnectionProfile } from "@/types/connection";
import { requestOpenConnectionProfile } from "@/lib/connection-bridge";
import { autoGroupId } from "@/lib/sidebar-groups";
import { openProfileSession } from "@/lib/open-profile-session";
import { useConnectionStore } from "@/stores/connection-store";
import { useHostsLayoutStore } from "@/stores/hosts-layout-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

function profileSubtitle(profile: ConnectionProfile): string {
  const user = profile.username || "user";
  const host = profile.host || "host";
  const port = profile.port ? `:${profile.port}` : "";
  return `${user}@${host}${port}`;
}

export function SortableHostItem({
  profile,
  index,
  sortableGroup,
  selectedProfileId,
  onDelete,
  remoteProfiles,
}: {
  profile: ConnectionProfile;
  index: number;
  sortableGroup: string;
  selectedProfileId: string | null;
  onDelete: () => void;
  remoteProfiles: ConnectionProfile[];
}) {
  const { t } = useTranslation(["connections", "common"]);
  const openHostEditor = useShellUiStore((state) => state.openHostEditor);
  const duplicateProfile = useConnectionStore((state) => state.duplicateProfile);
  const customGroups = useHostsLayoutStore((state) => state.customGroups);
  const moveProfileToGroup = useHostsLayoutStore(
    (state) => state.moveProfileToGroup,
  );
  const { ref, isDragging, isDropTarget } = useSortable({
    id: profile.id,
    index,
    group: sortableGroup,
    transition: { idle: true },
  });

  const isSelected = profile.id === selectedProfileId;
  const isFileProtocol =
    profile.protocol === "sftp" ||
    profile.protocol === "ftp" ||
    profile.protocol === "ftps";

  const handleConnect = () => {
    if (isFileProtocol) {
      void openProfileSession(profile);
      return;
    }
    void requestOpenConnectionProfile(profile.id);
  };

  const handleOpenSftp = () => {
    void openProfileSession({ ...profile, protocol: "sftp" });
  };

  const handleDuplicate = () => {
    const copy = duplicateProfile(profile.id);
    if (copy) {
      openHostEditor(copy.id);
    }
  };

  const handleMoveToGroup = (groupId: string) => {
    moveProfileToGroup(remoteProfiles, "custom", profile.id, groupId);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={ref}
            role="button"
            tabIndex={0}
            onClick={() => openHostEditor(profile.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openHostEditor(profile.id);
              }
            }}
            className={cn(
              "flex w-full cursor-grab flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors active:cursor-grabbing",
              isSelected
                ? "bg-foreground/12 text-foreground dark:bg-foreground/22"
                : "hover:bg-muted/50",
              isDragging && "opacity-50",
              isDropTarget && "bg-foreground/10 dark:bg-foreground/18",
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
          </div>
        }
      />
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => openHostEditor(profile.id)}>
          <PencilIcon />
          {t("connections:contextMenu.edit")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleConnect}>
          <PlugIcon />
          {isFileProtocol
            ? t("connections:actions.openFiles")
            : t("connections:manager.connect")}
        </ContextMenuItem>
        {profile.protocol === "ssh" ? (
          <ContextMenuItem onClick={handleOpenSftp}>
            <FolderIcon />
            {t("connections:actions.openSftp")}
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onClick={handleDuplicate}>
          <CopyIcon />
          {t("connections:contextMenu.duplicate")}
        </ContextMenuItem>
        {customGroups.length > 0 ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              {t("connections:contextMenu.moveToGroup")}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem
                onClick={() => handleMoveToGroup(autoGroupId(profile.protocol))}
              >
                {t("connections:contextMenu.ungrouped")}
              </ContextMenuItem>
              <ContextMenuSeparator />
              {customGroups.map((group) => (
                <ContextMenuItem
                  key={group.id}
                  onClick={() => handleMoveToGroup(group.id)}
                >
                  {group.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          {t("common:actions.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

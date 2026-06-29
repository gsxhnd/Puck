import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DragDropProvider } from "@dnd-kit/react";
import type { DragEndEvent } from "@dnd-kit/dom";
import { useConnectionStore } from "@/stores/connection-store";
import { useHostsLayoutStore } from "@/stores/hosts-layout-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import { deleteConnectionCredentials } from "@/lib/tauri-ssh";
import {
  buildHostGroups,
  hostGroupIdFromDropId,
  isHostGroupDropId,
  type HostSort,
} from "@/lib/hosts-groups";
import { HostGroup } from "@/layout/app-shell/primary-panel/host-group";

export function RemoteHostsPanel({
  sort,
  onSortChange,
  onRenameGroup,
}: {
  sort: HostSort;
  onSortChange: (sort: HostSort) => void;
  onRenameGroup: (groupId: string) => void;
}) {
  const { t } = useTranslation(["connections", "common"]);
  const profiles = useConnectionStore((state) => state.profiles);
  const removeProfile = useConnectionStore((state) => state.removeProfile);
  const selectedProfileId = useShellUiStore((state) => state.selectedProfileId);
  const closeHostEditor = useShellUiStore((state) => state.closeHostEditor);
  const customGroups = useHostsLayoutStore((state) => state.customGroups);
  const profileGroup = useHostsLayoutStore((state) => state.profileGroup);
  const groupOrder = useHostsLayoutStore((state) => state.groupOrder);
  const profileOrder = useHostsLayoutStore((state) => state.profileOrder);
  const hostGroupingEnabled = useHostsLayoutStore(
    (state) => state.hostGroupingEnabled,
  );
  const deleteGroup = useHostsLayoutStore((state) => state.deleteGroup);
  const reorderProfiles = useHostsLayoutStore((state) => state.reorderProfiles);
  const moveProfileToGroup = useHostsLayoutStore((state) => state.moveProfileToGroup);
  const pruneProfiles = useHostsLayoutStore((state) => state.pruneProfiles);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const remoteProfiles = useMemo(
    () =>
      profiles.filter(
        (profile) => profile.protocol !== "local" && !profile.ephemeral,
      ),
    [profiles],
  );

  const displayGroups = useMemo(
    () =>
      buildHostGroups(
        remoteProfiles,
        customGroups,
        profileGroup,
        groupOrder,
        profileOrder,
        hostGroupingEnabled,
        sort,
      ),
    [
      remoteProfiles,
      customGroups,
      profileGroup,
      groupOrder,
      profileOrder,
      hostGroupingEnabled,
      sort,
    ],
  );

  useEffect(() => {
    pruneProfiles(remoteProfiles.map((profile) => profile.id));
  }, [pruneProfiles, remoteProfiles]);

  const handleDelete = async (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    if (!window.confirm(t("connections:manager.deleteConfirm"))) return;
    await deleteConnectionCredentials(profileId);
    removeProfile(profileId);
    if (selectedProfileId === profileId) {
      closeHostEditor();
    }
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.canceled) return;

      const { source, target } = event.operation;
      if (!source || !target) return;

      const activeId = String(source.id);
      const targetId = String(target.id);
      if (activeId === targetId) return;

      if (isHostGroupDropId(targetId)) {
        moveProfileToGroup(
          remoteProfiles,
          sort,
          activeId,
          hostGroupIdFromDropId(targetId),
        );
      } else {
        reorderProfiles(remoteProfiles, sort, activeId, targetId);
      }
      onSortChange("custom");
    },
    [moveProfileToGroup, onSortChange, reorderProfiles, remoteProfiles, sort],
  );

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const groupOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let offset = 0;
    for (const group of displayGroups) {
      offsets.set(group.id, offset);
      offset += group.profiles.length;
    }
    return offsets;
  }, [displayGroups]);

  if (remoteProfiles.length === 0) {
    return (
      <div className="px-2 py-6 text-center text-xs text-muted-foreground">
        {t("connections:manager.empty")}
      </div>
    );
  }

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="space-y-2 pb-2">
        {displayGroups.map((group) => (
          <HostGroup
            key={group.id}
            group={group}
            collapsed={collapsedGroups.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
            onRename={
              group.isCustom ? () => onRenameGroup(group.id) : undefined
            }
            onDelete={group.isCustom ? () => deleteGroup(group.id) : undefined}
            selectedProfileId={selectedProfileId}
            profileIndexOffset={groupOffsets.get(group.id) ?? 0}
            onDeleteProfile={(profileId) => void handleDelete(profileId)}
            remoteProfiles={remoteProfiles}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}

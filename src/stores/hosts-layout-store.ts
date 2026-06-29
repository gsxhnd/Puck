import { create } from "zustand";
import { persist } from "zustand/middleware";
import { puckPersistStorage, PUCK_CONFIG_KEYS } from "@/lib/puck-config-storage";
import type { ConnectionProfile } from "@/types/connection";
import type { CustomSidebarGroup } from "@/lib/sidebar-groups";
import {
  type HostFlatItem,
  type HostSort,
  buildHostFlatLayout,
  createHostCustomGroupId,
  layoutFromHostFlatItems,
  moveHostFlatItemToGroup,
  pruneHostGroupOrder,
  reorderHostFlatItems,
} from "@/lib/hosts-groups";

function layoutSortForDrag(
  state: {
    customGroups: CustomSidebarGroup[];
    profileGroup: Record<string, string>;
  },
  sort: HostSort,
): HostSort {
  if (
    state.customGroups.length > 0 ||
    Object.keys(state.profileGroup).length > 0
  ) {
    return "custom";
  }
  return sort;
}

type HostsLayoutStore = {
  customGroups: CustomSidebarGroup[];
  profileGroup: Record<string, string>;
  groupOrder: string[];
  profileOrder: Record<string, string[]>;
  hostGroupingEnabled: boolean;
  setHostGroupingEnabled: (enabled: boolean) => void;
  createGroup: (name: string) => string;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  reorderProfiles: (
    profiles: ConnectionProfile[],
    sort: HostSort,
    activeId: string,
    overId: string,
  ) => void;
  moveProfileToGroup: (
    profiles: ConnectionProfile[],
    sort: HostSort,
    activeId: string,
    targetGroupId: string,
  ) => void;
  pruneProfiles: (activeProfileIds: string[]) => void;
};

function applyFlatLayoutUpdate(
  flat: HostFlatItem[],
  customGroups: CustomSidebarGroup[],
  existingGroupOrder: string[],
): Pick<
  HostsLayoutStore,
  "profileGroup" | "profileOrder" | "groupOrder"
> {
  const { profileGroup, profileOrder } = layoutFromHostFlatItems(flat);
  const pruned = pruneHostGroupOrder(
    existingGroupOrder,
    profileGroup,
    customGroups,
  );
  const known = new Set(pruned);
  const extra = [
    ...Object.keys(profileOrder),
    ...customGroups.map((group) => group.id),
  ].filter((id) => !known.has(id));

  return {
    profileGroup,
    profileOrder,
    groupOrder: [...pruned, ...extra],
  };
}

export const useHostsLayoutStore = create<HostsLayoutStore>()(
  persist(
    (set, get) => ({
      customGroups: [],
      profileGroup: {},
      groupOrder: [],
      profileOrder: {},
      hostGroupingEnabled: true,

      setHostGroupingEnabled: (hostGroupingEnabled) => set({ hostGroupingEnabled }),

      createGroup: (name) => {
        const trimmed = name.trim();
        const id = createHostCustomGroupId();
        set((state) => ({
          customGroups: [
            ...state.customGroups,
            { id, name: trimmed || "Group" },
          ],
          groupOrder: [...state.groupOrder, id],
        }));
        return id;
      },

      renameGroup: (groupId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          customGroups: state.customGroups.map((group) =>
            group.id === groupId ? { ...group, name: trimmed } : group,
          ),
        }));
      },

      deleteGroup: (groupId) => {
        set((state) => {
          const nextProfileGroup = { ...state.profileGroup };
          for (const [profileId, assignedGroupId] of Object.entries(
            nextProfileGroup,
          )) {
            if (assignedGroupId === groupId) {
              delete nextProfileGroup[profileId];
            }
          }

          const { [groupId]: _removed, ...nextProfileOrder } = state.profileOrder;

          return {
            customGroups: state.customGroups.filter(
              (group) => group.id !== groupId,
            ),
            groupOrder: state.groupOrder.filter((id) => id !== groupId),
            profileGroup: nextProfileGroup,
            profileOrder: nextProfileOrder,
          };
        });
      },

      reorderProfiles: (profiles, sort, activeId, overId) => {
        const state = get();
        const flat = buildHostFlatLayout(
          profiles,
          state.customGroups,
          state.profileGroup,
          state.groupOrder,
          state.profileOrder,
          state.hostGroupingEnabled,
          layoutSortForDrag(state, sort),
        );
        const nextFlat = reorderHostFlatItems(flat, activeId, overId);
        set(applyFlatLayoutUpdate(nextFlat, state.customGroups, state.groupOrder));
      },

      moveProfileToGroup: (profiles, sort, activeId, targetGroupId) => {
        const state = get();
        const flat = buildHostFlatLayout(
          profiles,
          state.customGroups,
          state.profileGroup,
          state.groupOrder,
          state.profileOrder,
          state.hostGroupingEnabled,
          layoutSortForDrag(state, sort),
        );
        const nextFlat = moveHostFlatItemToGroup(flat, activeId, targetGroupId);
        set(applyFlatLayoutUpdate(nextFlat, state.customGroups, state.groupOrder));
      },

      pruneProfiles: (activeProfileIds) => {
        const active = new Set(activeProfileIds);
        set((state) => {
          let changed = false;
          const nextProfileGroup = { ...state.profileGroup };
          for (const profileId of Object.keys(nextProfileGroup)) {
            if (!active.has(profileId)) {
              delete nextProfileGroup[profileId];
              changed = true;
            }
          }

          const nextProfileOrder: Record<string, string[]> = {};
          for (const [groupId, order] of Object.entries(state.profileOrder)) {
            const filtered = order.filter((profileId) => active.has(profileId));
            if (filtered.length !== order.length) changed = true;
            if (filtered.length > 0) nextProfileOrder[groupId] = filtered;
          }

          const nextGroupOrder = pruneHostGroupOrder(
            state.groupOrder,
            nextProfileGroup,
            state.customGroups,
          );
          if (nextGroupOrder.length !== state.groupOrder.length) {
            changed = true;
          }

          if (!changed) return state;
          return {
            profileGroup: nextProfileGroup,
            profileOrder: nextProfileOrder,
            groupOrder: nextGroupOrder,
          };
        });
      },
    }),
    {
      name: PUCK_CONFIG_KEYS.hostsLayout,
      storage: puckPersistStorage,
      skipHydration: true,
    },
  ),
);

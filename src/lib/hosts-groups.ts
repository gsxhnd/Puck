import type { ConnectionProfile } from "@/types/connection";
import {
  AUTO_GROUP_PREFIX,
  CUSTOM_GROUP_PREFIX,
  GROUP_DROP_PREFIX,
  autoGroupId,
  type CustomSidebarGroup,
  isCustomGroupId,
  layoutFromFlatItems,
  moveFlatItemToGroup,
  pruneGroupOrder,
  reorderFlatItems,
} from "@/lib/sidebar-groups";

export const HOST_SORTABLE_GROUP = "sidebar-hosts";
export const HOST_DEFAULT_GROUP = "host:default";

export type HostSort = "nameAsc" | "nameDesc" | "custom";

export type HostDisplayGroup = {
  id: string;
  name: string;
  isCustom: boolean;
  profiles: ConnectionProfile[];
};

export type HostFlatItem = {
  profileId: string;
  groupId: string;
};

export function isHostGroupDropId(id: string): boolean {
  return id.startsWith(GROUP_DROP_PREFIX);
}

export function hostGroupIdFromDropId(dropId: string): string {
  return dropId.slice(GROUP_DROP_PREFIX.length);
}

function sortProfiles(
  profiles: ConnectionProfile[],
  sort: HostSort,
): ConnectionProfile[] {
  const sorted = [...profiles];
  switch (sort) {
    case "nameDesc":
      return sorted.sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { sensitivity: "base" }),
      );
    case "custom":
      return sorted;
    default:
      return sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }
}

function resolveProfileGroupId(
  profile: ConnectionProfile,
  profileGroup: Record<string, string>,
): string {
  const assigned = profileGroup[profile.id];
  if (!assigned || assigned === HOST_DEFAULT_GROUP) {
    return autoGroupId(profile.protocol);
  }
  return assigned;
}

export function groupProfilesByProtocol(
  profiles: ConnectionProfile[],
): Array<{ key: string; profiles: ConnectionProfile[] }> {
  const groups = new Map<string, ConnectionProfile[]>();

  for (const profile of profiles) {
    const key = profile.protocol;
    const list = groups.get(key) ?? [];
    list.push(profile);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, groupedProfiles]) => ({
      key,
      profiles: groupedProfiles,
    }));
}

function orderProfilesInGroup(
  profiles: ConnectionProfile[],
  groupId: string,
  profileOrder: Record<string, string[]>,
): ConnectionProfile[] {
  const order = profileOrder[groupId];
  if (!order?.length) return profiles;

  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const ordered: ConnectionProfile[] = [];

  for (const id of order) {
    const profile = byId.get(id);
    if (profile) {
      ordered.push(profile);
      byId.delete(id);
    }
  }

  for (const profile of profiles) {
    if (byId.has(profile.id)) {
      ordered.push(profile);
    }
  }

  return ordered;
}

function groupNameForId(
  groupId: string,
  customGroups: CustomSidebarGroup[],
): string {
  const custom = customGroups.find((group) => group.id === groupId);
  if (custom) return custom.name;
  if (groupId.startsWith(AUTO_GROUP_PREFIX)) {
    return groupId.slice(AUTO_GROUP_PREFIX.length);
  }
  if (groupId === HOST_DEFAULT_GROUP) return "";
  return groupId;
}

function usesCustomLayout(
  customGroups: CustomSidebarGroup[],
  profileGroup: Record<string, string>,
  sort: HostSort,
): boolean {
  return (
    customGroups.length > 0 ||
    Object.keys(profileGroup).length > 0 ||
    sort === "custom"
  );
}

export function buildHostGroups(
  profiles: ConnectionProfile[],
  customGroups: CustomSidebarGroup[],
  profileGroup: Record<string, string>,
  groupOrder: string[],
  profileOrder: Record<string, string[]>,
  groupEnabled: boolean,
  sort: HostSort,
): HostDisplayGroup[] {
  const sorted = sortProfiles(profiles, sort);

  if (!groupEnabled) {
    return [
      {
        id: HOST_DEFAULT_GROUP,
        name: "",
        isCustom: false,
        profiles: sorted,
      },
    ];
  }

  if (!usesCustomLayout(customGroups, profileGroup, sort)) {
    return groupProfilesByProtocol(sorted).map((group) => ({
      id: autoGroupId(group.key),
      name: group.key,
      isCustom: false,
      profiles: group.profiles,
    }));
  }

  const buckets = new Map<string, ConnectionProfile[]>();

  for (const group of customGroups) {
    buckets.set(group.id, []);
  }

  for (const profile of sorted) {
    const groupId = resolveProfileGroupId(profile, profileGroup);
    const list = buckets.get(groupId) ?? [];
    list.push(profile);
    buckets.set(groupId, list);
  }

  const visibleGroupIds = new Set<string>([
    ...customGroups.map((group) => group.id),
    ...[...buckets.entries()]
      .filter(([, groupProfiles]) => groupProfiles.length > 0)
      .map(([groupId]) => groupId),
  ]);

  const orderedIds = [
    ...groupOrder.filter((id) => visibleGroupIds.has(id)),
    ...[...visibleGroupIds].filter((id) => !groupOrder.includes(id)),
  ];

  return orderedIds
    .map((groupId) => {
      const groupProfiles = buckets.get(groupId) ?? [];
      return {
        id: groupId,
        name: groupNameForId(groupId, customGroups),
        isCustom: isCustomGroupId(groupId),
        profiles: orderProfilesInGroup(groupProfiles, groupId, profileOrder),
      };
    })
    .filter((group) => group.isCustom || group.profiles.length > 0);
}

export function flattenHostGroups(groups: HostDisplayGroup[]): HostFlatItem[] {
  const flat: HostFlatItem[] = [];
  for (const group of groups) {
    for (const profile of group.profiles) {
      flat.push({ profileId: profile.id, groupId: group.id });
    }
  }
  return flat;
}

export function buildHostFlatLayout(
  profiles: ConnectionProfile[],
  customGroups: CustomSidebarGroup[],
  profileGroup: Record<string, string>,
  groupOrder: string[],
  profileOrder: Record<string, string[]>,
  groupEnabled: boolean,
  sort: HostSort,
): HostFlatItem[] {
  return flattenHostGroups(
    buildHostGroups(
      profiles,
      customGroups,
      profileGroup,
      groupOrder,
      profileOrder,
      groupEnabled,
      sort,
    ),
  );
}

export function layoutFromHostFlatItems(flat: HostFlatItem[]): {
  profileGroup: Record<string, string>;
  profileOrder: Record<string, string[]>;
} {
  const { sessionGroup, sessionOrder } = layoutFromFlatItems(
    flat.map((item) => ({
      sessionId: item.profileId,
      groupId: item.groupId,
    })),
  );
  return { profileGroup: sessionGroup, profileOrder: sessionOrder };
}

export function reorderHostFlatItems(
  flat: HostFlatItem[],
  activeId: string,
  overId: string,
): HostFlatItem[] {
  const next = reorderFlatItems(
    flat.map((item) => ({ sessionId: item.profileId, groupId: item.groupId })),
    activeId,
    overId,
  );
  return next.map((item) => ({
    profileId: item.sessionId,
    groupId: item.groupId,
  }));
}

export function moveHostFlatItemToGroup(
  flat: HostFlatItem[],
  activeId: string,
  targetGroupId: string,
): HostFlatItem[] {
  const next = moveFlatItemToGroup(
    flat.map((item) => ({ sessionId: item.profileId, groupId: item.groupId })),
    activeId,
    targetGroupId,
  );
  return next.map((item) => ({
    profileId: item.sessionId,
    groupId: item.groupId,
  }));
}

export function pruneHostGroupOrder(
  groupOrder: string[],
  profileGroup: Record<string, string>,
  customGroups: CustomSidebarGroup[],
): string[] {
  return pruneGroupOrder(groupOrder, profileGroup, customGroups);
}

export function createHostCustomGroupId(): string {
  return `${CUSTOM_GROUP_PREFIX}${crypto.randomUUID()}`;
}

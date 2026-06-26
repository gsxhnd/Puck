import type { Session } from "@/types/connection";
import { getSessionGroupKey, groupSessionsByDirectory } from "@/lib/session-display";

export const SIDEBAR_SORTABLE_GROUP = "sidebar-tabs";
export const AUTO_GROUP_PREFIX = "auto:";
export const CUSTOM_GROUP_PREFIX = "custom:";
export const GROUP_DROP_PREFIX = "group-drop:";

export type SessionSort = "nameAsc" | "nameDesc" | "recent" | "custom";

export type CustomSidebarGroup = {
  id: string;
  name: string;
};

export type SidebarDisplayGroup = {
  id: string;
  name: string;
  isCustom: boolean;
  sessions: Session[];
};

export type SidebarFlatItem = {
  sessionId: string;
  groupId: string;
};

export function autoGroupId(pathKey: string): string {
  return `${AUTO_GROUP_PREFIX}${pathKey}`;
}

export function isCustomGroupId(groupId: string): boolean {
  return groupId.startsWith(CUSTOM_GROUP_PREFIX);
}

export function isGroupDropId(id: string): boolean {
  return id.startsWith(GROUP_DROP_PREFIX);
}

export function groupIdFromDropId(dropId: string): string {
  return dropId.slice(GROUP_DROP_PREFIX.length);
}

function sessionSortKey(session: Session): string {
  return session.customTitle ?? session.tabLabel ?? session.title;
}

export function sortSessions(sessions: Session[], sort: SessionSort): Session[] {
  const sorted = [...sessions];
  switch (sort) {
    case "nameDesc":
      return sorted.sort((a, b) =>
        sessionSortKey(b).localeCompare(sessionSortKey(a)),
      );
    case "recent":
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "custom":
      return sorted;
    default:
      return sorted.sort((a, b) =>
        sessionSortKey(a).localeCompare(sessionSortKey(b)),
      );
  }
}

function resolveSessionGroupId(
  session: Session,
  sessionGroup: Record<string, string>,
): string {
  return sessionGroup[session.id] ?? autoGroupId(getSessionGroupKey(session));
}

function orderSessionsInGroup(
  sessions: Session[],
  groupId: string,
  sessionOrder: Record<string, string[]>,
): Session[] {
  const order = sessionOrder[groupId];
  if (!order?.length) return sessions;

  const byId = new Map(sessions.map((session) => [session.id, session]));
  const ordered: Session[] = [];

  for (const id of order) {
    const session = byId.get(id);
    if (session) {
      ordered.push(session);
      byId.delete(id);
    }
  }

  for (const session of sessions) {
    if (byId.has(session.id)) {
      ordered.push(session);
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
  return groupId;
}

function usesCustomLayout(
  customGroups: CustomSidebarGroup[],
  sessionGroup: Record<string, string>,
  sort: SessionSort,
): boolean {
  return (
    customGroups.length > 0 ||
    Object.keys(sessionGroup).length > 0 ||
    sort === "custom"
  );
}

export function buildSidebarGroups(
  sessions: Session[],
  customGroups: CustomSidebarGroup[],
  sessionGroup: Record<string, string>,
  groupOrder: string[],
  sessionOrder: Record<string, string[]>,
  sort: SessionSort,
): SidebarDisplayGroup[] {
  const sorted = sortSessions(sessions, sort);

  if (!usesCustomLayout(customGroups, sessionGroup, sort)) {
    return groupSessionsByDirectory(sorted).map((group) => ({
      id: autoGroupId(group.key),
      name: group.key,
      isCustom: false,
      sessions: group.sessions,
    }));
  }

  const buckets = new Map<string, Session[]>();

  for (const group of customGroups) {
    buckets.set(group.id, []);
  }

  for (const session of sorted) {
    const groupId = resolveSessionGroupId(session, sessionGroup);
    const list = buckets.get(groupId) ?? [];
    list.push(session);
    buckets.set(groupId, list);
  }

  const visibleGroupIds = new Set<string>([
    ...customGroups.map((group) => group.id),
    ...[...buckets.entries()]
      .filter(([, groupSessions]) => groupSessions.length > 0)
      .map(([groupId]) => groupId),
  ]);

  const orderedIds = [
    ...groupOrder.filter((id) => visibleGroupIds.has(id)),
    ...[...visibleGroupIds].filter((id) => !groupOrder.includes(id)),
  ];

  return orderedIds
    .map((groupId) => {
      const groupSessions = buckets.get(groupId) ?? [];
      return {
        id: groupId,
        name: groupNameForId(groupId, customGroups),
        isCustom: isCustomGroupId(groupId),
        sessions: orderSessionsInGroup(groupSessions, groupId, sessionOrder),
      };
    })
    .filter((group) => group.isCustom || group.sessions.length > 0);
}

export function flattenSidebarGroups(
  groups: SidebarDisplayGroup[],
): SidebarFlatItem[] {
  const flat: SidebarFlatItem[] = [];
  for (const group of groups) {
    for (const session of group.sessions) {
      flat.push({ sessionId: session.id, groupId: group.id });
    }
  }
  return flat;
}

/** Keep one entry per session; later entries win. */
export function dedupeFlatItems(flat: SidebarFlatItem[]): SidebarFlatItem[] {
  const lastBySession = new Map<string, SidebarFlatItem>();
  for (const item of flat) {
    lastBySession.set(item.sessionId, item);
  }

  const seen = new Set<string>();
  const deduped: SidebarFlatItem[] = [];
  for (const item of flat) {
    if (seen.has(item.sessionId)) continue;
    seen.add(item.sessionId);
    const latest = lastBySession.get(item.sessionId);
    if (latest) deduped.push(latest);
  }
  return deduped;
}

export function layoutFromFlatItems(flat: SidebarFlatItem[]): {
  sessionGroup: Record<string, string>;
  sessionOrder: Record<string, string[]>;
} {
  const uniqueFlat = dedupeFlatItems(flat);
  const sessionGroup: Record<string, string> = {};
  const sessionOrder: Record<string, string[]> = {};

  for (const item of uniqueFlat) {
    sessionGroup[item.sessionId] = item.groupId;
    const order = sessionOrder[item.groupId] ?? [];
    if (!order.includes(item.sessionId)) {
      order.push(item.sessionId);
    }
    sessionOrder[item.groupId] = order;
  }

  return { sessionGroup, sessionOrder };
}

export function reorderFlatItems(
  flat: SidebarFlatItem[],
  activeId: string,
  overId: string,
): SidebarFlatItem[] {
  const fromIndex = flat.findIndex((item) => item.sessionId === activeId);
  const toIndex = flat.findIndex((item) => item.sessionId === overId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return flat;
  }

  const next = [...flat];
  const [moved] = next.splice(fromIndex, 1);
  moved.groupId = flat[toIndex].groupId;
  next.splice(toIndex, 0, moved);
  return next;
}

export function moveFlatItemToGroup(
  flat: SidebarFlatItem[],
  activeId: string,
  targetGroupId: string,
): SidebarFlatItem[] {
  const next = flat.filter((item) => item.sessionId !== activeId);
  let lastInGroup = -1;
  for (let i = 0; i < next.length; i++) {
    if (next[i].groupId === targetGroupId) {
      lastInGroup = i;
    }
  }
  const insertAt = lastInGroup === -1 ? next.length : lastInGroup + 1;
  next.splice(insertAt, 0, { sessionId: activeId, groupId: targetGroupId });
  return next;
}

export function buildFlatLayout(
  sessions: Session[],
  customGroups: CustomSidebarGroup[],
  sessionGroup: Record<string, string>,
  groupOrder: string[],
  sessionOrder: Record<string, string[]>,
  sort: SessionSort,
): SidebarFlatItem[] {
  return flattenSidebarGroups(
    buildSidebarGroups(
      sessions,
      customGroups,
      sessionGroup,
      groupOrder,
      sessionOrder,
      sort,
    ),
  );
}

export function pruneGroupOrder(
  groupOrder: string[],
  sessionGroup: Record<string, string>,
  customGroups: CustomSidebarGroup[],
): string[] {
  const customIds = new Set(customGroups.map((group) => group.id));
  const activeAutoGroups = new Set(
    Object.values(sessionGroup).filter((id) => !isCustomGroupId(id)),
  );

  return groupOrder.filter(
    (id) => customIds.has(id) || activeAutoGroups.has(id),
  );
}

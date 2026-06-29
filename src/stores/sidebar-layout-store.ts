/**
 * Persistent state for custom sidebar groups and manual session ordering.
 *
 * 主侧栏自定义分组与手动排序的持久化 store。保存用户创建的分组、每个会话
 * 归属的分组、分组顺序以及各分组内的会话顺序。拖拽相关的复杂排序计算委托给
 * `sidebar-groups` 中的纯函数（先展开成扁平列表再写回），本 store 只负责状态
 * 编排与持久化；`pruneSessions` 用于清理已关闭会话残留的布局数据。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { puckPersistStorage, PUCK_CONFIG_KEYS } from "@/lib/puck-config-storage";
import type { Session } from "@/types/connection";
import {
  type CustomSidebarGroup,
  type SessionSort,
  type SidebarFlatItem,
  CUSTOM_GROUP_PREFIX,
  buildFlatLayout,
  layoutFromFlatItems,
  moveFlatItemToGroup,
  pruneGroupOrder,
  reorderFlatItems,
} from "@/lib/sidebar-groups";

// 一旦存在自定义分组或已分配的会话，拖拽就必须以 "custom" 排序为基准，
// 否则内置排序会覆盖用户的手动布局。
function layoutSortForDrag(
  state: {
    customGroups: CustomSidebarGroup[];
    sessionGroup: Record<string, string>;
  },
  sort: SessionSort,
): SessionSort {
  if (
    state.customGroups.length > 0 ||
    Object.keys(state.sessionGroup).length > 0
  ) {
    return "custom";
  }
  return sort;
}

type SidebarLayoutStore = {
  customGroups: CustomSidebarGroup[];
  sessionGroup: Record<string, string>;
  groupOrder: string[];
  sessionOrder: Record<string, string[]>;
  createGroup: (name: string) => string;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  reorderSessions: (
    terminalSessions: Session[],
    sort: SessionSort,
    activeId: string,
    overId: string,
  ) => void;
  moveSessionToGroup: (
    terminalSessions: Session[],
    sort: SessionSort,
    activeId: string,
    targetGroupId: string,
  ) => void;
  pruneSessions: (activeSessionIds: string[]) => void;
};

function applyFlatLayoutUpdate(
  flat: SidebarFlatItem[],
  customGroups: CustomSidebarGroup[],
  existingGroupOrder: string[],
): Pick<
  SidebarLayoutStore,
  "sessionGroup" | "sessionOrder" | "groupOrder"
> {
  const { sessionGroup, sessionOrder } = layoutFromFlatItems(flat);
  const pruned = pruneGroupOrder(
    existingGroupOrder,
    sessionGroup,
    customGroups,
  );
  const known = new Set(pruned);
  const extra = [
    ...Object.keys(sessionOrder),
    ...customGroups.map((group) => group.id),
  ].filter((id) => !known.has(id));

  return {
    sessionGroup,
    sessionOrder,
    groupOrder: [...pruned, ...extra],
  };
}

export const useSidebarLayoutStore = create<SidebarLayoutStore>()(
  persist(
    (set, get) => ({
      customGroups: [],
      sessionGroup: {},
      groupOrder: [],
      sessionOrder: {},

      createGroup: (name) => {
        const trimmed = name.trim();
        const id = `${CUSTOM_GROUP_PREFIX}${crypto.randomUUID()}`;
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
          const nextSessionGroup = { ...state.sessionGroup };
          for (const [sessionId, assignedGroupId] of Object.entries(
            nextSessionGroup,
          )) {
            if (assignedGroupId === groupId) {
              delete nextSessionGroup[sessionId];
            }
          }

          const { [groupId]: _removed, ...nextSessionOrder } =
            state.sessionOrder;

          return {
            customGroups: state.customGroups.filter(
              (group) => group.id !== groupId,
            ),
            groupOrder: state.groupOrder.filter((id) => id !== groupId),
            sessionGroup: nextSessionGroup,
            sessionOrder: nextSessionOrder,
          };
        });
      },

      reorderSessions: (terminalSessions, sort, activeId, overId) => {
        const state = get();
        const flat = buildFlatLayout(
          terminalSessions,
          state.customGroups,
          state.sessionGroup,
          state.groupOrder,
          state.sessionOrder,
          layoutSortForDrag(state, sort),
        );
        const nextFlat = reorderFlatItems(flat, activeId, overId);
        set(applyFlatLayoutUpdate(nextFlat, state.customGroups, state.groupOrder));
      },

      moveSessionToGroup: (terminalSessions, sort, activeId, targetGroupId) => {
        const state = get();
        const flat = buildFlatLayout(
          terminalSessions,
          state.customGroups,
          state.sessionGroup,
          state.groupOrder,
          state.sessionOrder,
          layoutSortForDrag(state, sort),
        );
        const nextFlat = moveFlatItemToGroup(flat, activeId, targetGroupId);
        set(applyFlatLayoutUpdate(nextFlat, state.customGroups, state.groupOrder));
      },

      pruneSessions: (activeSessionIds) => {
        const active = new Set(activeSessionIds);
        set((state) => {
          let changed = false;
          const nextSessionGroup = { ...state.sessionGroup };
          for (const sessionId of Object.keys(nextSessionGroup)) {
            if (!active.has(sessionId)) {
              delete nextSessionGroup[sessionId];
              changed = true;
            }
          }

          const nextSessionOrder: Record<string, string[]> = {};
          for (const [groupId, order] of Object.entries(state.sessionOrder)) {
            const filtered = order.filter((sessionId) => active.has(sessionId));
            if (filtered.length !== order.length) changed = true;
            if (filtered.length > 0) nextSessionOrder[groupId] = filtered;
          }

          const nextGroupOrder = pruneGroupOrder(
            state.groupOrder,
            nextSessionGroup,
            state.customGroups,
          );
          if (nextGroupOrder.length !== state.groupOrder.length) {
            changed = true;
          }

          if (!changed) return state;
          return {
            sessionGroup: nextSessionGroup,
            sessionOrder: nextSessionOrder,
            groupOrder: nextGroupOrder,
          };
        });
      },
    }),
    {
      name: PUCK_CONFIG_KEYS.sidebarLayout,
      storage: puckPersistStorage,
      skipHydration: true,
    },
  ),
);

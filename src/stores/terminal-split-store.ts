/**
 * Terminal pane split layout (nested tree of session IDs).
 *
 * 终端分屏布局 store：记录嵌套分屏树结构，支持在任意窗格上继续拆分，
 * 以及与活动会话列表同步、裁剪已关闭窗格。
 */
import { create } from "zustand";
import {
  branchNode,
  collectPaneSessionIds,
  layoutContainsSession,
  pruneSplitTree,
  splitPaneInTree,
  type TerminalSplitDirection,
  type TerminalSplitLayout,
} from "@/types/terminal-split";
import { useSessionStore } from "@/stores/session-store";

type TerminalSplitStore = {
  layout: TerminalSplitLayout | null;
  splitSession: (
    sourceSessionId: string,
    direction: TerminalSplitDirection,
  ) => void;
  clearSplit: () => void;
  syncWithSessions: (sessionIds: string[]) => void;
};

export const useTerminalSplitStore = create<TerminalSplitStore>()((set, get) => ({
  layout: null,
  splitSession: (sourceSessionId, direction) => {
    const source = useSessionStore
      .getState()
      .sessions.find((session) => session.id === sourceSessionId);

    if (!source || source.kind !== "terminal") {
      return;
    }

    const currentLayout = get().layout;
    const inCurrentSplit =
      currentLayout != null &&
      layoutContainsSession(currentLayout, sourceSessionId);

    const tabSessionId = inCurrentSplit
      ? currentLayout.tabSessionId
      : sourceSessionId;

    const newSession = useSessionStore.getState().addSession({
      kind: source.kind,
      title: source.title,
      profileId: source.profileId,
      protocol: source.protocol,
      shellId: source.shellId,
      shellName: source.shellName,
      tabLabel: source.tabLabel,
      customTitle: source.customTitle,
      titleMode: source.titleMode,
      titlePrefix: source.titlePrefix,
      cwd: source.cwd,
      status: source.protocol === "ssh" ? "creating" : undefined,
    });

    const root = inCurrentSplit
      ? splitPaneInTree(
          currentLayout.root,
          sourceSessionId,
          direction,
          newSession.id,
        )
      : branchNode(direction, sourceSessionId, newSession.id);

    set({
      layout: {
        tabSessionId,
        root,
      },
    });

    const focusId =
      direction === "left" || direction === "up"
        ? newSession.id
        : sourceSessionId;
    useSessionStore.getState().setActiveSession(focusId);
  },
  clearSplit: () => set({ layout: null }),
  syncWithSessions: (sessionIds) => {
    const layout = get().layout;
    if (!layout) {
      return;
    }

    const activeIds = new Set(sessionIds);
    const pruned = pruneSplitTree(layout.root, activeIds);

    if (!pruned) {
      set({ layout: null });
      return;
    }

    const paneIds = collectPaneSessionIds(pruned);
    if (paneIds.length < 2) {
      set({ layout: null });
      return;
    }

    const tabSessionId = activeIds.has(layout.tabSessionId)
      ? layout.tabSessionId
      : paneIds[0]!;

    if (pruned !== layout.root || tabSessionId !== layout.tabSessionId) {
      set({
        layout: {
          tabSessionId,
          root: pruned,
        },
      });
    }
  },
}));

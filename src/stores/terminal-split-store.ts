import { create } from "zustand";
import {
  splitOrientation,
  splitPaneOrder,
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

    const paneSessionIds = splitPaneOrder(
      sourceSessionId,
      newSession.id,
      direction,
    );

    set({
      layout: {
        orientation: splitOrientation(direction),
        paneSessionIds,
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
    const remaining = layout.paneSessionIds.filter((id) => activeIds.has(id));

    if (remaining.length < 2) {
      set({ layout: null });
      return;
    }

    if (remaining.length !== layout.paneSessionIds.length) {
      set({
        layout: {
          ...layout,
          paneSessionIds: [remaining[0], remaining[1]] as [string, string],
        },
      });
    }
  },
}));

/**
 * In-memory store for workbench tabs.
 *
 * 工作台标签栏的运行时 store。保存两类标签的元数据（编辑器 / Diff）与激活
 * 状态：编辑器标签的文本、dirty 与保存状态由 EditorDocumentManager 通过
 * documentId 关联；Diff 标签的对比文本由 diff-content 注册表通过 tab id
 * 关联（避免把大段文本放进 Zustand）。不持久化——标签随应用重启清空
 * （与 session-store 一致）。
 */
import { create } from "zustand";
import { removeDiffContent } from "@/editor/diff-content";
import type { RemoteDesktopProtocol } from "@/types/workbench";

/** UI metadata for one open editor tab. / 单个已打开编辑器标签的 UI 元数据。 */
export type WorkbenchEditorTab = {
  kind: "editor";
  /** Tab id, equal to the document id. / 标签 id，即 documentId。 */
  id: string;
  title: string;
  path: string;
};

/** UI metadata for one read-only diff tab. / 单个只读 Diff 标签的 UI 元数据。 */
export type WorkbenchDiffTab = {
  kind: "diff";
  id: string;
  title: string;
  path: string;
  language: string;
};

/** UI metadata for one remote desktop tab. / 单个远程桌面标签的 UI 元数据。 */
export type WorkbenchRemoteDesktopTab = {
  kind: "remoteDesktop";
  /** Tab id, equal to the backend session id. / 标签 id，即后端 sessionId。 */
  id: string;
  sessionId: string;
  protocol: RemoteDesktopProtocol;
  title: string;
  host: string;
  status: "connecting" | "connected" | "failed";
  errorMessage?: string;
};

/** Union of every workbench center-area tab. / 工作台中央区所有标签的联合。 */
export type WorkbenchTabItem =
  | WorkbenchEditorTab
  | WorkbenchDiffTab
  | WorkbenchRemoteDesktopTab;

type WorkbenchStore = {
  tabs: WorkbenchTabItem[];
  activeTabId: string | null;
  openEditorTab: (tab: WorkbenchEditorTab) => void;
  openDiffTab: (tab: WorkbenchDiffTab) => void;
  openRemoteDesktopTab: (tab: WorkbenchRemoteDesktopTab) => void;
  updateRemoteDesktopTab: (
    sessionId: string,
    update: Partial<Pick<WorkbenchRemoteDesktopTab, "status" | "errorMessage">>,
  ) => void;
  setActiveTab: (id: string) => void;
  closeTab: (id: string) => void;
};

export const useWorkbenchStore = create<WorkbenchStore>()((set) => ({
  tabs: [],
  activeTabId: null,

  openEditorTab: (tab) => {
    set((state) => ({
      tabs: upsertTab(state.tabs, tab),
      activeTabId: tab.id,
    }));
  },

  openDiffTab: (tab) => {
    set((state) => ({
      tabs: upsertTab(state.tabs, tab),
      activeTabId: tab.id,
    }));
  },

  openRemoteDesktopTab: (tab) => {
    set((state) => ({
      tabs: upsertTab(state.tabs, tab),
      activeTabId: tab.id,
    }));
  },

  updateRemoteDesktopTab: (sessionId, update) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.kind === "remoteDesktop" && tab.sessionId === sessionId
          ? { ...tab, ...update }
          : tab,
      ),
    }));
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  closeTab: (id) => {
    set((state) => {
      const index = state.tabs.findIndex((item) => item.id === id);
      if (index < 0) return state;

      // Diff tab contents live outside the store; drop them here so they do
      // not leak when the tab closes.
      // Diff 内容存放在 store 之外，关闭标签时在这里同步清理，避免泄漏。
      if (state.tabs[index]?.kind === "diff") {
        removeDiffContent(id);
      }

      const tabs = state.tabs.filter((item) => item.id !== id);
      let activeTabId = state.activeTabId;
      if (state.activeTabId === id) {
        // Activate the neighbouring tab after closing the active one.
        // 关闭当前激活标签后，激活相邻的标签。
        activeTabId = tabs[Math.min(index, tabs.length - 1)]?.id ?? null;
      }
      return { tabs, activeTabId };
    });
  },
}));

/** Replaces an existing tab with the same id, otherwise appends. / 同 id 标签原位更新，否则追加。 */
function upsertTab(tabs: WorkbenchTabItem[], tab: WorkbenchTabItem): WorkbenchTabItem[] {
  const exists = tabs.some((item) => item.id === tab.id);
  return exists
    ? tabs.map((item) => (item.id === tab.id ? tab : item))
    : [...tabs, tab];
}

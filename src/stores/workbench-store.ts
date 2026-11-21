/**
 * In-memory store for workbench tabs.
 *
 * 工作台标签栏的运行时 store。保存编辑器 / Diff / Git Graph 标签的元数据与
 * 激活状态：编辑器标签的文本、dirty 与保存状态由 EditorDocumentManager 通过
 * documentId 关联；Diff 标签的对比文本由 diff-content 注册表通过 tab id
 * 关联（避免把大段文本放进 Zustand）。不持久化——标签随应用重启清空
 * （与 session-store 一致）。
 */
import { create } from "zustand";
import { removeDiffContent } from "@/editor/diff-content";
import { useWorkspaceStore } from "@/stores/workspace-store";

/** UI metadata for one open editor tab. / 单个已打开编辑器标签的 UI 元数据。 */
export type WorkbenchEditorTab = {
  kind: "editor";
  /** Tab id, equal to the document id. / 标签 id，即 documentId。 */
  id: string;
  title: string;
  path: string;
  workspaceId?: string;
};

/** UI metadata for one read-only diff tab. / 单个只读 Diff 标签的 UI 元数据。 */
export type WorkbenchDiffTab = {
  kind: "diff";
  id: string;
  title: string;
  path: string;
  language: string;
  workspaceId?: string;
};

/** UI metadata for one Git graph tab. / 单个 Git 提交图标签的 UI 元数据。 */
export type WorkbenchGitGraphTab = {
  kind: "gitGraph";
  id: string;
  title: string;
  path: string;
  source: "local" | "remote";
  workspaceId: string;
  connectionId?: string;
};

/** Union of every workbench center-area tab. / 工作台中央区所有标签的联合。 */
export type WorkbenchTabItem =
  | WorkbenchEditorTab
  | WorkbenchDiffTab
  | WorkbenchGitGraphTab;

type WorkbenchStore = {
  tabs: WorkbenchTabItem[];
  activeTabId: string | null;
  openEditorTab: (tab: WorkbenchEditorTab) => void;
  openDiffTab: (tab: WorkbenchDiffTab) => void;
  openGitGraphTab: (tab: WorkbenchGitGraphTab) => void;
  setActiveTab: (id: string | null) => void;
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

  openGitGraphTab: (tab) => {
    set((state) => ({
      tabs: upsertTab(state.tabs, tab),
      activeTabId: tab.id,
    }));
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  closeTab: (id) => {
    set((state) => {
      const closing = state.tabs.find((item) => item.id === id);
      if (!closing) return state;

      // Diff tab contents live outside the store; drop them here so they do
      // not leak when the tab closes.
      // Diff 内容存放在 store 之外，关闭标签时在这里同步清理，避免泄漏。
      if (closing.kind === "diff") {
        removeDiffContent(id);
      }

      const workspaceId = useWorkspaceStore.getState().activeWorkspace?.id;
      const visible = tabsInWorkspace(state.tabs, workspaceId);
      const index = visible.findIndex((item) => item.id === id);
      const tabs = state.tabs.filter((item) => item.id !== id);
      let activeTabId = state.activeTabId;
      if (state.activeTabId === id) {
        const visibleAfter = tabsInWorkspace(tabs, workspaceId);
        // Activate the neighbouring visible tab after closing the active one.
        // 关闭当前激活标签后，激活同一 Workspace 内相邻的可见标签。
        activeTabId =
          visibleAfter[Math.min(Math.max(index, 0), visibleAfter.length - 1)]?.id ??
          null;
      }
      return { tabs, activeTabId };
    });
  },
}));

function tabWorkspaceId(tab: WorkbenchTabItem): string | undefined {
  if (tab.kind === "editor" || tab.kind === "diff" || tab.kind === "gitGraph") {
    return tab.workspaceId;
  }
  return undefined;
}

function tabsInWorkspace(
  tabs: WorkbenchTabItem[],
  workspaceId: string | undefined,
): WorkbenchTabItem[] {
  return tabs.filter((tab) => tabWorkspaceId(tab) === workspaceId);
}

/** Returns the tabs that belong to one workspace. / 返回属于指定 Workspace 的标签。 */
export function workbenchTabsForWorkspace(
  tabs: WorkbenchTabItem[],
  workspaceId: string | undefined,
): WorkbenchTabItem[] {
  return tabsInWorkspace(tabs, workspaceId);
}

/** Replaces an existing tab with the same id, otherwise appends. / 同 id 标签原位更新，否则追加。 */
function upsertTab(tabs: WorkbenchTabItem[], tab: WorkbenchTabItem): WorkbenchTabItem[] {
  const exists = tabs.some((item) => item.id === tab.id);
  return exists
    ? tabs.map((item) => (item.id === tab.id ? tab : item))
    : [...tabs, tab];
}

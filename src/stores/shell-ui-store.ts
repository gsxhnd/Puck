/**
 * Ephemeral shell layout UI state (panel visibility and second-panel view).
 *
 * 应用外壳的瞬时 UI 状态：主/次面板是否展开、次面板当前显示的视图（信息、
 * 大纲、文件、Git、传输队列等）。不持久化——启动时的默认值来自
 * app-settings-store，运行中通过快捷键或命令面板切换。
 */
import { create } from "zustand";
import type { PrimaryPanelTab, SecondPanelView } from "@/types/shell-ui";

type ShellUiStore = {
  primaryPanelOpen: boolean;
  secondPanelOpen: boolean;
  secondPanelView: SecondPanelView;
  primaryPanelTab: PrimaryPanelTab;
  selectedProfileId: string | null;
  hostEditorOpen: boolean;
  setPrimaryPanelOpen: (open: boolean) => void;
  setSecondPanelOpen: (open: boolean) => void;
  setSecondPanelView: (view: SecondPanelView) => void;
  setPrimaryPanelTab: (tab: PrimaryPanelTab) => void;
  openHostEditor: (profileId: string | null) => void;
  closeHostEditor: () => void;
  showSessionPanel: () => void;
  togglePrimaryPanel: () => void;
  toggleSecondPanel: () => void;
  showSecondPanelView: (view: SecondPanelView) => void;
};

export const useShellUiStore = create<ShellUiStore>()((set) => ({
  primaryPanelOpen: true,
  secondPanelOpen: true,
  secondPanelView: "info",
  primaryPanelTab: "sessions",
  selectedProfileId: null,
  hostEditorOpen: false,
  setPrimaryPanelOpen: (primaryPanelOpen) => set({ primaryPanelOpen }),
  setSecondPanelOpen: (secondPanelOpen) => set({ secondPanelOpen }),
  setSecondPanelView: (secondPanelView) => set({ secondPanelView }),
  setPrimaryPanelTab: (primaryPanelTab) =>
    set({
      primaryPanelTab,
      ...(primaryPanelTab === "sessions"
        ? { hostEditorOpen: false, selectedProfileId: null }
        : { hostEditorOpen: false, selectedProfileId: null }),
    }),
  openHostEditor: (selectedProfileId) =>
    set({
      primaryPanelTab: "hosts",
      selectedProfileId,
      hostEditorOpen: true,
    }),
  closeHostEditor: () =>
    set({ hostEditorOpen: false, selectedProfileId: null }),
  showSessionPanel: () =>
    set({
      primaryPanelTab: "sessions",
      hostEditorOpen: false,
      selectedProfileId: null,
    }),
  togglePrimaryPanel: () =>
    set((state) => ({ primaryPanelOpen: !state.primaryPanelOpen })),
  toggleSecondPanel: () =>
    set((state) => ({ secondPanelOpen: !state.secondPanelOpen })),
  showSecondPanelView: (secondPanelView) =>
    set({ secondPanelOpen: true, secondPanelView }),
}));

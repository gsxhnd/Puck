import { create } from "zustand";
import type { SecondPanelView } from "@/types/shell-ui";

type ShellUiStore = {
  primaryPanelOpen: boolean;
  secondPanelOpen: boolean;
  secondPanelView: SecondPanelView;
  setPrimaryPanelOpen: (open: boolean) => void;
  setSecondPanelOpen: (open: boolean) => void;
  setSecondPanelView: (view: SecondPanelView) => void;
  togglePrimaryPanel: () => void;
  toggleSecondPanel: () => void;
  showSecondPanelView: (view: SecondPanelView) => void;
};

export const useShellUiStore = create<ShellUiStore>()((set) => ({
  primaryPanelOpen: true,
  secondPanelOpen: true,
  secondPanelView: "info",
  setPrimaryPanelOpen: (primaryPanelOpen) => set({ primaryPanelOpen }),
  setSecondPanelOpen: (secondPanelOpen) => set({ secondPanelOpen }),
  setSecondPanelView: (secondPanelView) => set({ secondPanelView }),
  togglePrimaryPanel: () =>
    set((state) => ({ primaryPanelOpen: !state.primaryPanelOpen })),
  toggleSecondPanel: () =>
    set((state) => ({ secondPanelOpen: !state.secondPanelOpen })),
  showSecondPanelView: (secondPanelView) =>
    set({ secondPanelOpen: true, secondPanelView }),
}));

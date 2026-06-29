import { create } from "zustand";

export type CommandPalettePage = "root" | "open-in";

type CommandPaletteStore = {
  open: boolean;
  page: CommandPalettePage;
  openPalette: () => void;
  closePalette: () => void;
  setPage: (page: CommandPalettePage) => void;
};

export const useCommandPaletteStore = create<CommandPaletteStore>()((set) => ({
  open: false,
  page: "root",
  openPalette: () => set({ open: true, page: "root" }),
  closePalette: () => set({ open: false, page: "root" }),
  setPage: (page) => set({ page }),
}));

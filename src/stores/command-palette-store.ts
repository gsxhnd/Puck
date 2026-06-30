/**
 * Command palette open/close state and draft query.
 *
 * 全局命令面板的开关状态与预填查询（如 `connect ` 前缀）。由快捷键 ⇧⌘P
 * 或侧栏「选择终端」等入口触发打开，关闭时自动清空草稿。
 */
import { create } from "zustand";

type CommandPaletteStore = {
  open: boolean;
  draftQuery: string;
  openPalette: (draftQuery?: string) => void;
  openConnectPalette: () => void;
  closePalette: () => void;
  setDraftQuery: (query: string) => void;
  consumeDraftQuery: () => void;
};

export const useCommandPaletteStore = create<CommandPaletteStore>()((set) => ({
  open: false,
  draftQuery: "",
  openPalette: (draftQuery = "") => set({ open: true, draftQuery }),
  openConnectPalette: () => set({ open: true, draftQuery: "connect " }),
  closePalette: () => set({ open: false, draftQuery: "" }),
  setDraftQuery: (query) => set({ draftQuery: query }),
  consumeDraftQuery: () => set({ draftQuery: "" }),
}));

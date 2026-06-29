/**
 * Command palette open/close state and current sub-page.
 *
 * 全局命令面板的开关状态与当前子页面（根列表或「用外部应用打开」）。由
 * 快捷键 ⌘K 或终端标题菜单触发打开，关闭时自动重置到根页面。
 */
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

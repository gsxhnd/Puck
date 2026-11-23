/**
 * Handles native menu actions in the workspace shell.
 *
 * 处理原生菜单动作：新建 Workspace 终端、打开连接管理、关闭当前编辑器或终端
 * 标签，以及切换侧栏 / 终端区域。
 */
import { openConnectionsWindow } from "@/lib/open-connections-window";
import { createWorkspaceTerminal, toggleTerminalPanel } from "@/lib/workspace-actions";
import { closeActiveSessionTab } from "@/lib/terminal-split-sessions";
import { closeActiveTab } from "@/lib/workbench-editor-actions";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSessionStore } from "@/stores/session-store";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";
import { useWorkbenchStore } from "@/stores/workbench-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

/** Handle a native menu bar action emitted from the Rust backend. */
export function handleMenuAction(action: string) {
  switch (action) {
    case "new_terminal":
      void createWorkspaceTerminal();
      break;
    case "new_connection":
    case "browse_connections":
      void openConnectionsWindow();
      break;
    case "close_tab": {
      const workbench = useWorkbenchStore.getState();
      if (workbench.activeTabId) {
        closeActiveTab();
        break;
      }
      const { activeSessionId } = useSessionStore.getState();
      closeActiveSessionTab(activeSessionId);
      break;
    }
    case "command_palette":
      useCommandPaletteStore.getState().openPalette();
      break;
    case "toggle_sidebar":
      useWorkspaceStore.getState().toggleSidebar();
      break;
    case "toggle_terminal":
      toggleTerminalPanel();
      break;
    case "find":
      useTerminalSearchStore.getState().openSearch("tab");
      break;
    case "find_in_all_tabs":
      useTerminalSearchStore.getState().openSearch("all");
      break;
    default:
      break;
  }
}

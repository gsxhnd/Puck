import { openConnectionsWindow } from "@/lib/open-connections-window";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSessionStore } from "@/stores/session-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";

/** Handle a native macOS menu bar action emitted from the Rust backend. */
export function handleMenuAction(action: string) {
  switch (action) {
    case "new_terminal": {
      const { addSession } = useSessionStore.getState();
      useShellUiStore.getState().showSessionPanel();
      addSession({
        kind: "terminal",
        title: "__local__",
        protocol: "local",
      });
      break;
    }
    case "new_connection":
      useShellUiStore.getState().openHostEditor(null);
      break;
    case "browse_connections":
      void openConnectionsWindow();
      break;
    case "close_tab": {
      const { activeSessionId, closeSession } = useSessionStore.getState();
      if (activeSessionId) {
        closeSession(activeSessionId);
      }
      break;
    }
    case "command_palette":
      useCommandPaletteStore.getState().openPalette();
      break;
    case "toggle_primary_panel":
      useShellUiStore.getState().togglePrimaryPanel();
      break;
    case "toggle_second_panel":
      useShellUiStore.getState().toggleSecondPanel();
      break;
    case "find":
      useTerminalSearchStore.getState().openSearch("tab");
      break;
    case "find_in_all_tabs":
      useTerminalSearchStore.getState().openSearch("all");
      break;
    case "jump_to_outline":
      window.dispatchEvent(new CustomEvent("puck:focus-outline"));
      break;
    default:
      break;
  }
}

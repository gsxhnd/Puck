import type { Terminal } from "@xterm/xterm";
import {
  parseTerminalInput,
  type CommandInputState,
} from "@/lib/terminal-command-input";
import { useCommandOutlineStore } from "@/stores/command-outline-store";

export function trackTerminalCommandInput(
  sessionId: string,
  terminal: Terminal,
  data: string,
  state: CommandInputState,
) {
  const command = parseTerminalInput(data, state);
  if (!command) {
    return;
  }

  const bufferLine =
    terminal.buffer.active.baseY + terminal.buffer.active.cursorY;

  useCommandOutlineStore.getState().addEntry(sessionId, {
    command,
    bufferLine,
    createdAt: Date.now(),
  });
}

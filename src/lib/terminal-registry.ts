import type { Terminal } from "@xterm/xterm";

const terminals = new Map<string, Terminal>();

export function registerTerminal(sessionId: string, terminal: Terminal) {
  terminals.set(sessionId, terminal);
}

export function unregisterTerminal(sessionId: string) {
  terminals.delete(sessionId);
}

export function scrollTerminalToLine(sessionId: string, line: number): boolean {
  const terminal = terminals.get(sessionId);
  if (!terminal) {
    return false;
  }

  terminal.scrollToLine(Math.max(0, line));
  terminal.focus();
  return true;
}

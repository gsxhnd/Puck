import type { IDisposable, Terminal } from "@xterm/xterm";

export function bindCopyOnSelect(
  terminal: Terminal,
  enabled: boolean,
): IDisposable {
  if (!enabled) {
    return { dispose: () => {} };
  }

  return terminal.onSelectionChange(() => {
    const selection = terminal.getSelection();
    if (!selection) return;
    void navigator.clipboard.writeText(selection);
  });
}

import type { ITheme } from "@xterm/xterm";
import { getUiSyncedTerminalTheme } from "@/lib/terminal-themes";

type TerminalThemeSnapshot = {
  key: string;
  theme: ITheme;
};

const listeners = new Set<() => void>();

let snapshot: TerminalThemeSnapshot = {
  key: "initial",
  theme: getUiSyncedTerminalTheme(),
};

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function buildTerminalThemeKey(
  resolvedTheme: string | undefined,
  colorTheme: string,
): string {
  return `${resolvedTheme ?? "unknown"}:${colorTheme}`;
}

/** Recompute terminal colors once per UI theme change. */
export function syncTerminalThemeCache(key: string): ITheme {
  if (snapshot.key === key) {
    return snapshot.theme;
  }

  snapshot = {
    key,
    theme: getUiSyncedTerminalTheme(),
  };
  emit();
  return snapshot.theme;
}

export function getTerminalThemeSnapshot(): ITheme {
  return snapshot.theme;
}

export function subscribeTerminalTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

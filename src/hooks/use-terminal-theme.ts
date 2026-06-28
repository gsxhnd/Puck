import { useSyncExternalStore } from "react";
import type { ITheme } from "@xterm/xterm";
import {
  getTerminalThemeSnapshot,
  subscribeTerminalTheme,
} from "@/lib/terminal-theme-bridge";

export function useTerminalTheme(): ITheme {
  return useSyncExternalStore(
    subscribeTerminalTheme,
    getTerminalThemeSnapshot,
    getTerminalThemeSnapshot,
  );
}

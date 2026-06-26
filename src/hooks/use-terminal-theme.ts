import { useMemo } from "react";
import { useTheme } from "next-themes";
import type { ITheme } from "@xterm/xterm";
import { getUiSyncedTerminalTheme } from "@/lib/terminal-themes";
import { useAppSettingsStore } from "@/stores/app-settings-store";

export function useTerminalTheme(): ITheme {
  const { resolvedTheme } = useTheme();
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);

  return useMemo(
    () => getUiSyncedTerminalTheme(),
    [resolvedTheme, colorTheme],
  );
}

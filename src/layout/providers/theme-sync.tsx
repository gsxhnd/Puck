import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppSettingsStore } from "@/stores/app-settings-store";

/** Keeps next-themes in sync with persisted app settings. */
export function ThemeSync() {
  const { setTheme } = useTheme();
  const uiTheme = useAppSettingsStore((state) => state.uiTheme);

  useEffect(() => {
    setTheme(uiTheme);
  }, [setTheme, uiTheme]);

  return null;
}

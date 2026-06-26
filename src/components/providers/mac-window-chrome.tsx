import { useEffect } from "react";
import { getPlatform, isTauri } from "@/lib/platform";

/** Enables transparent-root + rounded shell styling for macOS Tauri windows. */
export function MacWindowChrome() {
  useEffect(() => {
    const enabled = isTauri() && getPlatform() === "macos";
    const root = document.documentElement;

    if (enabled) {
      root.dataset.windowChrome = "macos-tauri";
    } else {
      delete root.dataset.windowChrome;
    }

    return () => {
      delete root.dataset.windowChrome;
    };
  }, []);

  return null;
}

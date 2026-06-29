import { useEffect } from "react";
import { getAppWindowMode } from "@/lib/app-window";
import { rehydrateAppSettings } from "@/lib/rehydrate-app-settings";
import { rehydrateConnections } from "@/lib/rehydrate-connections";

/**
 * Keeps settings and connections auxiliary windows in sync when opened or focused.
 * Complements event-based sync when a window was created before a remote change.
 */
export function AuxiliaryWindowSync() {
  useEffect(() => {
    const mode = getAppWindowMode();
    if (mode === "main") return;

    const sync = () => {
      void rehydrateAppSettings();
      if (mode === "connections") {
        void rehydrateConnections();
      }
    };

    sync();

    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return null;
}

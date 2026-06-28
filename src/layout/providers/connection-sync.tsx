import { useEffect } from "react";
import { useConnectionStore } from "@/stores/connection-store";

export const CONNECTION_STORAGE_KEY = "puck-connections";

/** Rehydrate persisted connections when another window updates localStorage. */
export function ConnectionSync() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CONNECTION_STORAGE_KEY) return;
      void useConnectionStore.persist.rehydrate();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

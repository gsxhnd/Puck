import {
  PUCK_CONFIG_KEYS,
  reloadPuckConfigKey,
} from "@/lib/puck-config-storage";
import { useConnectionStore } from "@/stores/connection-store";

/** Reload saved connection profiles from disk into the connection store. */
export async function rehydrateConnections(): Promise<void> {
  await reloadPuckConfigKey(PUCK_CONFIG_KEYS.connections);
  await useConnectionStore.persist.rehydrate();
}

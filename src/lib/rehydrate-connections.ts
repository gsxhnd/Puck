import { reloadConnectionPersistStorage } from "@/lib/connection-persist-storage";
import { useConnectionStore } from "@/stores/connection-store";

/** Reload saved connection profiles from disk into the connection store. */
export async function rehydrateConnections(): Promise<void> {
  await reloadConnectionPersistStorage();
  await useConnectionStore.persist.rehydrate();
}

import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/platform";

export const CONNECTION_OPEN_EVENT = "connection:open-profile";

export type ConnectionOpenPayload = {
  profileId: string;
};

const BROADCAST_CHANNEL_NAME = "puck-connection-open";

async function focusMainWindow(): Promise<void> {
  if (!isTauri()) return;

  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const main = await WebviewWindow.getByLabel("main");
  if (!main) return;
  await main.show();
  await main.setFocus();
}

export async function requestOpenConnectionProfile(
  profileId: string,
): Promise<void> {
  const payload: ConnectionOpenPayload = { profileId };

  if (isTauri()) {
    await emit(CONNECTION_OPEN_EVENT, payload);
    await focusMainWindow();
    return;
  }

  const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  channel.postMessage(payload);
  channel.close();
}

export function subscribeConnectionOpenRequests(
  onOpen: (profileId: string) => void,
): () => void {
  const cleanups: Array<() => void> = [];

  const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  const onMessage = (event: MessageEvent<ConnectionOpenPayload>) => {
    if (event.data?.profileId) {
      onOpen(event.data.profileId);
    }
  };
  channel.addEventListener("message", onMessage);
  cleanups.push(() => {
    channel.removeEventListener("message", onMessage);
    channel.close();
  });

  if (isTauri()) {
    let unlisten: UnlistenFn | undefined;
    void listen<ConnectionOpenPayload>(CONNECTION_OPEN_EVENT, (event) => {
      if (event.payload?.profileId) {
        onOpen(event.payload.profileId);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    cleanups.push(() => {
      unlisten?.();
    });
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

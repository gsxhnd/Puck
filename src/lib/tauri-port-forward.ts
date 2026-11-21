/**
 * IPC wrappers and events for SSH local port forwarding.
 *
 * SSH 本地端口转发 IPC 封装。组件不直接 invoke，运行状态通过 forward:status
 * 事件同步，端口列表在 Workspace 切换时重新读取。
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isRecord } from "@/lib/ipc-parse";

export type StartLocalForwardRequest = {
  forwardId: string;
  connectionId: string;
  localHost?: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
};

export type PortForwardInfo = {
  forwardId: string;
  connectionId: string;
  localAddress: string;
  remoteHost: string;
  remotePort: number;
  status: "running" | "stopped" | "failed";
  error?: string;
};

function parseForward(value: unknown): PortForwardInfo | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.forwardId !== "string" ||
    typeof value.connectionId !== "string" ||
    typeof value.localAddress !== "string" ||
    typeof value.remoteHost !== "string" ||
    typeof value.remotePort !== "number" ||
    typeof value.status !== "string"
  ) {
    return null;
  }
  return {
    forwardId: value.forwardId,
    connectionId: value.connectionId,
    localAddress: value.localAddress,
    remoteHost: value.remoteHost,
    remotePort: value.remotePort,
    status: value.status === "failed" ? "failed" : value.status === "stopped" ? "stopped" : "running",
    error: typeof value.error === "string" ? value.error : undefined,
  };
}

export function startLocalPortForward(
  request: StartLocalForwardRequest,
): Promise<PortForwardInfo> {
  return invoke("start_local_port_forward", { request });
}

export function stopLocalPortForward(forwardId: string): Promise<void> {
  return invoke("stop_local_port_forward", { forwardId });
}

export async function listLocalPortForwards(
  connectionId?: string,
): Promise<PortForwardInfo[]> {
  const result = await invoke<unknown>("list_local_port_forwards", { connectionId });
  if (!Array.isArray(result)) return [];
  return result
    .map(parseForward)
    .filter((item): item is PortForwardInfo => item !== null);
}

export function onPortForwardStatus(
  handler: (event: PortForwardInfo) => void,
): Promise<UnlistenFn> {
  return listen<unknown>("forward:status", (event) => {
    const parsed = parseForward(event.payload);
    if (parsed) handler(parsed);
  });
}

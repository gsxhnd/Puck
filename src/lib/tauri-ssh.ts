import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isRecord } from "@/lib/ipc-parse";
import { listenWithCleanup } from "@/lib/tauri-listener";
import type { ConnectionProfile } from "@/types/connection";
import type { HostKeyPrompt } from "@/lib/puck-error";

export type SshConnectRequest = {
  sessionId: string;
  connectionId: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  privateKeyPath?: string;
  password?: string;
  passphrase?: string;
  cols: number;
  rows: number;
};

export type SessionStatusEvent = {
  sessionId: string;
  status: string;
  errorCode?: string;
  message?: string;
  hostKey?: HostKeyPrompt;
};

export type KnownHostRecord = HostKeyPrompt & {
  publicKey: string;
};

function parseHostKeyPrompt(value: unknown): HostKeyPrompt | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.host !== "string" ||
    typeof value.port !== "number" ||
    typeof value.keyType !== "string" ||
    typeof value.fingerprint !== "string" ||
    typeof value.publicKey !== "string"
  ) {
    return null;
  }
  return {
    host: value.host,
    port: value.port,
    keyType: value.keyType,
    fingerprint: value.fingerprint,
    publicKey: value.publicKey,
  };
}

function parseKnownHostRecord(value: unknown): KnownHostRecord | null {
  const prompt = parseHostKeyPrompt(value);
  return prompt;
}

function parseSessionStatusEvent(value: unknown): SessionStatusEvent | null {
  if (!isRecord(value)) return null;
  if (typeof value.sessionId !== "string" || typeof value.status !== "string") {
    return null;
  }
  const hostKey = value.hostKey
    ? parseHostKeyPrompt(value.hostKey) ?? undefined
    : undefined;
  return {
    sessionId: value.sessionId,
    status: value.status,
    errorCode:
      typeof value.errorCode === "string" ? value.errorCode : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
    hostKey,
  };
}

export function profileToSshRequest(
  sessionId: string,
  profile: ConnectionProfile,
  cols: number,
  rows: number,
): SshConnectRequest {
  return {
    sessionId,
    connectionId: profile.id,
    host: profile.host ?? "",
    port: profile.port ?? 22,
    username: profile.username ?? "",
    authMethod: profile.authMethod ?? "password",
    privateKeyPath: profile.privateKeyPath,
    cols,
    rows,
  };
}

export async function hasCredential(
  connectionId: string,
  field: "password" | "passphrase",
): Promise<boolean> {
  const result = await invoke<unknown>("has_credential", { connectionId, field });
  return result === true;
}

export function saveCredential(
  connectionId: string,
  field: "password" | "passphrase",
  secret: string,
): Promise<void> {
  return invoke("save_credential", { connectionId, field, secret });
}

export function deleteCredential(
  connectionId: string,
  field: "password" | "passphrase",
): Promise<void> {
  return invoke("delete_credential", { connectionId, field });
}

export function deleteConnectionCredentials(connectionId: string): Promise<void> {
  return invoke("delete_connection_credentials", { connectionId });
}

export async function listKnownHosts(): Promise<KnownHostRecord[]> {
  const result = await invoke<unknown>("list_known_hosts");
  if (!Array.isArray(result)) return [];
  return result
    .map((item) => parseKnownHostRecord(item))
    .filter((item): item is KnownHostRecord => item !== null);
}

export async function deleteKnownHost(host: string, port: number): Promise<boolean> {
  const result = await invoke<unknown>("delete_known_host", { host, port });
  return result === true;
}

export async function trustSshHostKey(prompt: HostKeyPrompt): Promise<KnownHostRecord> {
  const result = await invoke<unknown>("trust_ssh_host_key", {
    host: prompt.host,
    port: prompt.port,
    publicKey: prompt.publicKey,
  });
  const parsed = parseKnownHostRecord(result);
  if (!parsed) {
    throw new Error("Invalid trust host key response");
  }
  return parsed;
}

export function openSshTerminal(request: SshConnectRequest): Promise<void> {
  return invoke("open_ssh_terminal", { request });
}

export function reconnectSshTerminal(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("reconnect_ssh_terminal", { sessionId, cols, rows });
}

export function onSessionStatus(
  handler: (event: SessionStatusEvent) => void,
): Promise<UnlistenFn> {
  return listen<unknown>("session:status", (event) => {
    const parsed = parseSessionStatusEvent(event.payload);
    if (parsed) handler(parsed);
  });
}

export function subscribeSessionStatus(
  handler: (event: SessionStatusEvent) => void,
): () => void {
  return listenWithCleanup<unknown>("session:status", (event) => {
    const parsed = parseSessionStatusEvent(event.payload);
    if (parsed) handler(parsed);
  });
}

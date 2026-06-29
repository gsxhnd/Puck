import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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
  cols: number;
  rows: number;
};

export type SessionStatusEvent = {
  sessionId: string;
  status: string;
  errorCode?: string;
  message?: string;
};

export type KnownHostRecord = HostKeyPrompt & {
  publicKey: string;
};

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

export function hasCredential(
  connectionId: string,
  field: "password" | "passphrase",
): Promise<boolean> {
  return invoke("has_credential", { connectionId, field });
}

export function saveCredential(
  connectionId: string,
  field: "password" | "passphrase",
  secret: string,
): Promise<void> {
  return invoke("save_credential", { connectionId, field, secret });
}

export function deleteConnectionCredentials(connectionId: string): Promise<void> {
  return invoke("delete_connection_credentials", { connectionId });
}

export function listKnownHosts(): Promise<KnownHostRecord[]> {
  return invoke("list_known_hosts");
}

export function deleteKnownHost(host: string, port: number): Promise<boolean> {
  return invoke("delete_known_host", { host, port });
}

export function trustSshHostKey(prompt: HostKeyPrompt): Promise<KnownHostRecord> {
  return invoke("trust_ssh_host_key", {
    host: prompt.host,
    port: prompt.port,
    publicKey: prompt.publicKey,
  });
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
  return listen<SessionStatusEvent>("session:status", (event) => {
    handler(event.payload);
  });
}

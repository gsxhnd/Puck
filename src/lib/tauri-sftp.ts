import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ConnectionProfile } from "@/types/connection";

export type RemoteFileEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified?: number;
  permissions?: string;
};

export type OpenFileConnectionRequest = {
  sessionId: string;
  connectionId: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  privateKeyPath?: string;
  password?: string;
  passphrase?: string;
  defaultDirectory?: string;
};

export type TransferProgressEvent = {
  transferId: string;
  bytesTransferred: number;
  bytesTotal?: number;
};

export type TransferDoneEvent = {
  transferId: string;
};

export type TransferErrorEvent = {
  transferId: string;
  message: string;
};

export function profileToFileRequest(
  sessionId: string,
  profile: ConnectionProfile,
): OpenFileConnectionRequest {
  const defaultPort =
    profile.protocol === "ftp" || profile.protocol === "ftps" ? 21 : 22;
  return {
    sessionId,
    connectionId: profile.id,
    host: profile.host ?? "",
    port: profile.port ?? defaultPort,
    username: profile.username ?? "",
    authMethod: profile.authMethod ?? "password",
    privateKeyPath: profile.privateKeyPath,
    defaultDirectory: profile.defaultDirectory,
  };
}

export function openFileConnection(
  request: OpenFileConnectionRequest,
): Promise<void> {
  return invoke("open_file_connection", { request });
}

export function listRemoteDir(
  sessionId: string,
  path?: string,
): Promise<RemoteFileEntry[]> {
  return invoke("list_remote_dir", { sessionId, path });
}

export function mkdirRemote(sessionId: string, path: string): Promise<void> {
  return invoke("mkdir_remote", { sessionId, path });
}

export function deleteRemote(sessionId: string, path: string): Promise<void> {
  return invoke("delete_remote", { sessionId, path });
}

export function renameRemote(
  sessionId: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  return invoke("rename_remote", { sessionId, oldPath, newPath });
}

export function startTransfer(args: {
  sessionId: string;
  transferId: string;
  direction: "upload" | "download";
  localPath: string;
  remotePath: string;
}): Promise<void> {
  return invoke("start_transfer", args);
}

export function readRemoteFile(
  sessionId: string,
  path: string,
): Promise<string> {
  return invoke<string>("read_remote_file_command", { sessionId, path });
}

export function writeRemoteFile(
  sessionId: string,
  path: string,
  content: string,
): Promise<void> {
  return invoke("write_remote_file_command", { sessionId, path, content });
}

export function onTransferProgress(
  handler: (event: TransferProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<TransferProgressEvent>("transfer:progress", (event) => {
    handler(event.payload);
  });
}

export function onTransferDone(
  handler: (event: TransferDoneEvent) => void,
): Promise<UnlistenFn> {
  return listen<TransferDoneEvent>("transfer:done", (event) => {
    handler(event.payload);
  });
}

export function onTransferError(
  handler: (event: TransferErrorEvent) => void,
): Promise<UnlistenFn> {
  return listen<TransferErrorEvent>("transfer:error", (event) => {
    handler(event.payload);
  });
}

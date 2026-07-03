import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isRecord } from "@/lib/ipc-parse";
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

function parseRemoteFileEntry(value: unknown): RemoteFileEntry | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.name !== "string" ||
    typeof value.path !== "string" ||
    typeof value.isDir !== "boolean" ||
    typeof value.size !== "number"
  ) {
    return null;
  }
  return {
    name: value.name,
    path: value.path,
    isDir: value.isDir,
    size: value.size,
    modified: typeof value.modified === "number" ? value.modified : undefined,
    permissions:
      typeof value.permissions === "string" ? value.permissions : undefined,
  };
}

function parseRemoteFileEntries(value: unknown): RemoteFileEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => parseRemoteFileEntry(item))
    .filter((item): item is RemoteFileEntry => item !== null);
}

function parseTransferProgressEvent(value: unknown): TransferProgressEvent | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.transferId !== "string" ||
    typeof value.bytesTransferred !== "number"
  ) {
    return null;
  }
  return {
    transferId: value.transferId,
    bytesTransferred: value.bytesTransferred,
    bytesTotal:
      typeof value.bytesTotal === "number" ? value.bytesTotal : undefined,
  };
}

function parseTransferDoneEvent(value: unknown): TransferDoneEvent | null {
  if (!isRecord(value)) return null;
  if (typeof value.transferId !== "string") return null;
  return { transferId: value.transferId };
}

function parseTransferErrorEvent(value: unknown): TransferErrorEvent | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.transferId !== "string" ||
    typeof value.message !== "string"
  ) {
    return null;
  }
  return { transferId: value.transferId, message: value.message };
}

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

export async function listRemoteDir(
  sessionId: string,
  path?: string,
): Promise<RemoteFileEntry[]> {
  const result = await invoke<unknown>("list_remote_dir", { sessionId, path });
  return parseRemoteFileEntries(result);
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

export async function readRemoteFile(
  sessionId: string,
  path: string,
): Promise<string> {
  const result = await invoke<unknown>("read_remote_file_command", {
    sessionId,
    path,
  });
  if (typeof result !== "string") {
    throw new Error("Invalid read remote file response");
  }
  return result;
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
  return listen<unknown>("transfer:progress", (event) => {
    const parsed = parseTransferProgressEvent(event.payload);
    if (parsed) handler(parsed);
  });
}

export function onTransferDone(
  handler: (event: TransferDoneEvent) => void,
): Promise<UnlistenFn> {
  return listen<unknown>("transfer:done", (event) => {
    const parsed = parseTransferDoneEvent(event.payload);
    if (parsed) handler(parsed);
  });
}

export function onTransferError(
  handler: (event: TransferErrorEvent) => void,
): Promise<UnlistenFn> {
  return listen<unknown>("transfer:error", (event) => {
    const parsed = parseTransferErrorEvent(event.payload);
    if (parsed) handler(parsed);
  });
}

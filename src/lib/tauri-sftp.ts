import { invoke } from "@tauri-apps/api/core";
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

export function profileToFileRequest(
  sessionId: string,
  profile: ConnectionProfile,
): OpenFileConnectionRequest {
  const defaultPort = 22;
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

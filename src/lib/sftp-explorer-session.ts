import type { ConnectionProfile } from "@/types/connection";
import {
  listRemoteDir,
  openFileConnection,
  profileToFileRequest,
} from "@/lib/tauri-sftp";
import { onSessionStatus } from "@/lib/tauri-ssh";
import { parsePuckError } from "@/lib/puck-error";
import {
  markConnectionEstablished,
  peekConnectionSecrets,
  resolveSecretsForConnection,
} from "@/lib/resolve-connection-credential";
import { closeSession } from "@/lib/tauri-terminal";

const EXPLORER_SUFFIX = "__explorer";
const EDITOR_PREFIX = "editor:";

export function explorerSftpSessionId(terminalSessionId: string): string {
  return `${terminalSessionId}${EXPLORER_SUFFIX}`;
}

/** Stable SFTP session id owned by the editor for one connection. / 编辑器为单个连接持有的稳定 SFTP 会话 id。 */
export function editorSftpSessionId(connectionId: string): string {
  return `${EDITOR_PREFIX}${connectionId}`;
}

/** True when the session is managed by the editor registry (not an explorer session). / 判断会话是否由编辑器注册表管理。 */
export function isEditorSftpSessionId(sessionId: string): boolean {
  return sessionId.startsWith(EDITOR_PREFIX);
}

function isMissingSftpSession(error: unknown): boolean {
  const message = parsePuckError(error).message.toLowerCase();
  return message.includes("sftp session not found");
}

function waitForSessionStatus(
  sessionId: string,
  targetStatus: string,
  timeoutMs = 30_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let unlisten: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      unlisten?.();
      reject(new Error("SFTP connection timed out"));
    }, timeoutMs);

    void onSessionStatus((event) => {
      if (event.sessionId !== sessionId) return;
      if (event.status === targetStatus) {
        window.clearTimeout(timer);
        unlisten?.();
        resolve();
      }
      if (event.status === "failed") {
        window.clearTimeout(timer);
        unlisten?.();
        reject(new Error(event.message ?? "SFTP connection failed"));
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
  });
}

export async function ensureSftpExplorerSession(
  terminalSessionId: string,
  profile: ConnectionProfile,
): Promise<void> {
  await ensureSftpSession(explorerSftpSessionId(terminalSessionId), profile);
}

/**
 * Ensures an SFTP session exists for the given session id.
 *
 * 确保指定 session id 的 SFTP 会话可用：先探测是否已连接，缺失时解析凭据、
 * 建立连接并等待 connected 状态。explorer 与 editor registry 共用该实现，
 * 只是 session id 不同（`editor:<connectionId>` 由编辑器独占，explorer 关闭
 * 不影响正在编辑的远程文档）。
 */
export async function ensureSftpSession(
  sessionId: string,
  profile: ConnectionProfile,
): Promise<void> {
  try {
    await listRemoteDir(sessionId, "/");
    markConnectionEstablished(profile.id, "sftp", ["ssh", "sftp"]);
    return;
  } catch (error) {
    if (!isMissingSftpSession(error)) {
      throw error;
    }
  }

  const secrets =
    peekConnectionSecrets(profile.id) ??
    (await resolveSecretsForConnection(profile));
  if (secrets === null) {
    throw new Error("cancelled");
  }

  const connected = waitForSessionStatus(sessionId, "connected");
  await openFileConnection({
    ...profileToFileRequest(sessionId, profile),
    ...secrets,
  });
  await connected;
  markConnectionEstablished(profile.id, "sftp", ["ssh", "sftp"]);
}

export async function closeSftpExplorerSession(
  terminalSessionId: string,
): Promise<void> {
  try {
    await closeSession(explorerSftpSessionId(terminalSessionId));
  } catch {
    // Explorer SFTP may already be closed.
  }
}

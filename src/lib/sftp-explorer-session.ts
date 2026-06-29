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

export function explorerSftpSessionId(terminalSessionId: string): string {
  return `${terminalSessionId}${EXPLORER_SUFFIX}`;
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
  const sessionId = explorerSftpSessionId(terminalSessionId);

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

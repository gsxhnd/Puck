/**
 * Owns the base SSH lease for the active remote workspace.
 *
 * 持有活动远程 Workspace 的基础 SSH 租约，统一处理凭据、Host Key 和连接状态；
 * Git、SFTP、终端及端口转发在此基础上各自获取独立租约。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HostKeyDialog } from "@/components/ssh/host-key-dialog";
import { isHostKeyError, parsePuckError, type HostKeyPrompt } from "@/lib/puck-error";
import {
  clearConnectionSecrets,
  peekConnectionSecrets,
  resolveSecretsForConnection,
} from "@/lib/resolve-connection-credential";
import {
  ensureSharedSshConnection,
  profileToSshRequest,
  releaseSharedSshConnection,
  trustSshHostKey,
} from "@/lib/tauri-ssh";
import { useConnectionStore } from "@/stores/connection-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function workspaceSshOwnerId(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

export function RemoteWorkspaceConnection() {
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const setRemoteStatus = useWorkspaceStore((state) => state.setRemoteStatus);
  const profile = useConnectionStore((state) =>
    workspace?.profileId ? state.getProfile(workspace.profileId) : undefined,
  );
  const [hostKeyPrompt, setHostKeyPrompt] = useState<HostKeyPrompt | null>(null);
  const attemptRef = useRef(0);

  const connect = useCallback(async () => {
    if (!workspace || workspace.source !== "remote" || !profile) return;
    const attempt = ++attemptRef.current;
    const isCurrent = () => attemptRef.current === attempt;
    setRemoteStatus("connecting");
    const ownerId = workspaceSshOwnerId(workspace.id);
    try {
      const secrets = peekConnectionSecrets(profile.id) ??
        (await resolveSecretsForConnection(profile));
      if (!isCurrent()) return;
      if (secrets === null) {
        setRemoteStatus("failed");
        return;
      }
      await ensureSharedSshConnection(
        {
          ...profileToSshRequest(workspace.id, profile, 80, 24, workspace.rootPath),
          ...secrets,
        },
        ownerId,
      );
      if (!isCurrent()) {
        await releaseSharedSshConnection(profile.id, ownerId);
        return;
      }
      setHostKeyPrompt(null);
      setRemoteStatus("connected");
    } catch (error) {
      if (!isCurrent()) return;
      const hostKey = isHostKeyError(error);
      if (hostKey) {
        setHostKeyPrompt(hostKey);
        return;
      }
      setRemoteStatus("failed");
      const payload = parsePuckError(error);
      if (payload.message !== "cancelled") toast.error(payload.message);
    }
  }, [profile, setRemoteStatus, workspace]);

  useEffect(() => {
    if (workspace?.source === "remote") {
      if (profile) void connect();
      else setRemoteStatus("failed");
    } else {
      setRemoteStatus("disconnected");
    }

    return () => {
      // Bump the attempt token before releasing so a late handshake cannot
      // overwrite the state of the next workspace.
      attemptRef.current += 1;
      if (workspace?.source === "remote" && profile) {
        void releaseSharedSshConnection(
          profile.id,
          workspaceSshOwnerId(workspace.id),
        );
        clearConnectionSecrets(profile.id);
      }
    };
  }, [connect, profile, setRemoteStatus, workspace]);

  const trustAndReconnect = useCallback(() => {
    if (!hostKeyPrompt) return;
    void trustSshHostKey(hostKeyPrompt)
      .then(() => {
        setHostKeyPrompt(null);
        return connect();
      })
      .catch((error) => toast.error(parsePuckError(error).message));
  }, [connect, hostKeyPrompt]);

  return (
    <HostKeyDialog
      open={hostKeyPrompt !== null}
      prompt={hostKeyPrompt}
      onConfirm={trustAndReconnect}
      onCancel={() => {
        setHostKeyPrompt(null);
        setRemoteStatus("failed");
      }}
    />
  );
}

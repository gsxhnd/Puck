import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import { useTransferStore } from "@/stores/transfer-store";
import { closeSession } from "@/lib/tauri-terminal";
import { RECONNECT_SESSION_EVENT } from "@/lib/reconnect-session";
import {
  resolveConnectionCredential,
  takeConnectionSecrets,
} from "@/lib/resolve-connection-credential";
import {
  deleteRemote,
  listRemoteDir,
  mkdirRemote,
  onTransferDone,
  onTransferError,
  onTransferProgress,
  openFileConnection,
  profileToFileRequest,
  renameRemote,
  startTransfer,
  type RemoteFileEntry,
} from "@/lib/tauri-sftp";
import { onSessionStatus, trustSshHostKey } from "@/lib/tauri-ssh";
import { parsePuckError } from "@/lib/puck-error";
import type { HostKeyPrompt } from "@/lib/puck-error";
import { HostKeyDialog } from "@/components/ssh/host-key-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FileManagerToolbar } from "@/page/files/file-manager/file-toolbar";
import { RemoteFileTable } from "@/page/files/file-manager/remote-file-table";
import {
  buildBreadcrumbs,
  joinRemotePath,
  sortRemoteEntries,
} from "@/page/files/file-manager/utils";

/**
 * SFTP/SSH remote file browser for a session tab.
 *
 * 会话标签内的远程文件管理器。通过 SFTP 连接浏览远端目录，支持上传、下载、
 * 新建文件夹、重命名与删除；传输进度写入全局 transfer store。首次连接若遇到
 * 未知 SSH 主机密钥，会弹出信任确认对话框。
 */
export function FileManager({
  sessionId,
  profileId,
  active,
  layout = "stack",
}: {
  sessionId: string;
  profileId?: string;
  active: boolean;
  focused?: boolean;
  layout?: "stack" | "pane";
}) {
  const { t } = useTranslation(["files", "errors", "common"]);
  const profile = useConnectionStore((state) =>
    profileId ? state.getProfile(profileId) : undefined,
  );
  const updateSessionStatus = useSessionStore(
    (state) => state.updateSessionStatus,
  );
  const addTransferTask = useTransferStore((state) => state.addTask);
  const updateProgress = useTransferStore((state) => state.updateProgress);
  const markDone = useTransferStore((state) => state.markDone);
  const markFailed = useTransferStore((state) => state.markFailed);

  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<RemoteFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [hostKeyPrompt, setHostKeyPrompt] = useState<HostKeyPrompt | null>(null);

  const supported = profile?.protocol === "sftp" || profile?.protocol === "ssh";
  const breadcrumbs = useMemo(() => buildBreadcrumbs(cwd), [cwd]);

  const refresh = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listRemoteDir(sessionId, cwd);
      setEntries(sortRemoteEntries(list));
    } catch (err) {
      setError(parsePuckError(err).message);
    } finally {
      setLoading(false);
    }
  }, [connected, cwd, sessionId]);

  const connect = useCallback(async () => {
    if (!profile || !supported) return;
    updateSessionStatus(sessionId, "creating");
    setError(null);

    let secrets = takeConnectionSecrets(profile.id);
    if (profile.askPasswordEachTime) {
      const resolved = await resolveConnectionCredential(profile);
      if (resolved === null) {
        updateSessionStatus(sessionId, "failed");
        return;
      }
      secrets = resolved;
    }

    void openFileConnection({
      ...profileToFileRequest(sessionId, profile),
      ...secrets,
    });
  }, [profile, sessionId, supported, updateSessionStatus]);

  const handleReconnect = useCallback(async () => {
    setConnected(false);
    setError(null);
    setEntries([]);
    await closeSession(sessionId);
    connect();
  }, [connect, sessionId]);

  useEffect(() => {
    if (!profile || !supported) return;

    let disposed = false;
    let unlistenStatus: (() => void) | undefined;

    void (async () => {
      unlistenStatus = await onSessionStatus((event) => {
        if (event.sessionId !== sessionId || disposed) return;
        if (event.errorCode === "host_key_unknown" && event.hostKey) {
          useShellUiStore.getState().showSessionPanel();
          setHostKeyPrompt(event.hostKey);
          return;
        }
        if (event.status === "connected") {
          setConnected(true);
          const initial = profile.defaultDirectory?.trim() || "/";
          setCwd(initial);
          updateSessionStatus(sessionId, "connected");
        }
        if (event.status === "failed") {
          updateSessionStatus(sessionId, "failed");
          setError(event.message ?? t("errors:unknown_error"));
        }
      });

      if (disposed) return;
      connect();
    })();

    return () => {
      disposed = true;
      unlistenStatus?.();
      void closeSession(sessionId);
    };
  }, [connect, profile, sessionId, supported, updateSessionStatus]);

  useEffect(() => {
    const onReconnect = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string }>).detail;
      if (detail.sessionId !== sessionId) return;
      void handleReconnect();
    };

    window.addEventListener(RECONNECT_SESSION_EVENT, onReconnect);
    return () => window.removeEventListener(RECONNECT_SESSION_EVENT, onReconnect);
  }, [handleReconnect, sessionId]);

  useEffect(() => {
    if (!connected) return;
    void refresh();
  }, [connected, refresh]);

  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    void (async () => {
      unlistenProgress = await onTransferProgress(updateProgress);
      unlistenDone = await onTransferDone(markDone);
      unlistenError = await onTransferError(markFailed);
    })();
    return () => {
      unlistenProgress?.();
      unlistenDone?.();
      unlistenError?.();
    };
  }, [markDone, markFailed, updateProgress]);

  const navigateTo = (path: string) => {
    setSelectedPath(null);
    setCwd(path);
  };

  const handleEntryOpen = (entry: RemoteFileEntry) => {
    if (entry.isDir) {
      navigateTo(entry.path);
      return;
    }
    setSelectedPath(entry.path);
  };

  const handleUpload = async () => {
    const localPath = await open({ multiple: false });
    if (typeof localPath !== "string") return;
    const fileName = localPath.split(/[/\\]/).pop() ?? "upload";
    const remotePath = joinRemotePath(cwd, fileName);
    const transferId = crypto.randomUUID();
    addTransferTask({
      id: transferId,
      sessionId,
      direction: "upload",
      localPath,
      remotePath,
      fileName,
    });
    try {
      await startTransfer({
        sessionId,
        transferId,
        direction: "upload",
        localPath,
        remotePath,
      });
    } catch (err) {
      markFailed({
        transferId,
        message: parsePuckError(err).message,
      });
    }
    void refresh();
  };

  const handleDownload = async () => {
    if (!selectedPath) return;
    const fileName = selectedPath.split("/").pop() ?? "download";
    const localPath = await save({ defaultPath: fileName });
    if (typeof localPath !== "string") return;
    const transferId = crypto.randomUUID();
    addTransferTask({
      id: transferId,
      sessionId,
      direction: "download",
      localPath,
      remotePath: selectedPath,
      fileName,
    });
    try {
      await startTransfer({
        sessionId,
        transferId,
        direction: "download",
        localPath,
        remotePath: selectedPath,
      });
    } catch (err) {
      markFailed({
        transferId,
        message: parsePuckError(err).message,
      });
    }
  };

  const handleMkdir = async () => {
    const name = window.prompt(t("files:prompts.newFolder"));
    if (!name?.trim()) return;
    const path = joinRemotePath(cwd, name.trim());
    await mkdirRemote(sessionId, path);
    void refresh();
  };

  const handleDelete = async () => {
    if (!selectedPath) return;
    if (!window.confirm(t("files:prompts.deleteConfirm"))) return;
    await deleteRemote(sessionId, selectedPath);
    setSelectedPath(null);
    void refresh();
  };

  const handleRename = async () => {
    if (!selectedPath || !renameValue.trim()) return;
    const oldName = selectedPath.split("/").pop() ?? "";
    const parent = selectedPath.slice(0, selectedPath.length - oldName.length);
    const newPath = `${parent}${renameValue.trim()}`;
    await renameRemote(sessionId, selectedPath, newPath);
    setRenaming(false);
    setSelectedPath(newPath);
    void refresh();
  };

  const handleTrustHostKey = async () => {
    if (!hostKeyPrompt) return;
    await trustSshHostKey(hostKeyPrompt);
    setHostKeyPrompt(null);
    await connect();
  };

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("files:errors.noProfile")}
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {t("files:errors.unsupportedProtocol", { protocol: profile.protocol })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        layout === "stack"
          ? "absolute inset-0 flex min-h-0 flex-col"
          : "flex h-full min-h-0 flex-col",
        !active && "pointer-events-none invisible",
      )}
    >
      <FileManagerToolbar
        breadcrumbs={breadcrumbs}
        connected={connected}
        selectedPath={selectedPath}
        onNavigate={navigateTo}
        onRefresh={() => void refresh()}
        onMkdir={() => void handleMkdir()}
        onUpload={() => void handleUpload()}
        onDownload={() => void handleDownload()}
        onRename={() => {
          setRenaming(true);
          if (selectedPath) {
            setRenameValue(selectedPath.split("/").pop() ?? "");
          }
        }}
        onDelete={() => void handleDelete()}
      />

      {error ? (
        <div className="bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {renaming ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleRename();
              if (event.key === "Escape") setRenaming(false);
            }}
          />
          <Button size="sm" onClick={() => void handleRename()}>
            {t("common:actions.save")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRenaming(false)}>
            {t("common:actions.cancel")}
          </Button>
        </div>
      ) : null}

      <RemoteFileTable
        cwd={cwd}
        entries={entries}
        loading={loading}
        selectedPath={selectedPath}
        onNavigate={navigateTo}
        onOpenEntry={handleEntryOpen}
      />

      <HostKeyDialog
        open={Boolean(hostKeyPrompt)}
        prompt={hostKeyPrompt}
        onConfirm={() => void handleTrustHostKey()}
        onCancel={() => {
          setHostKeyPrompt(null);
          updateSessionStatus(sessionId, "failed");
        }}
      />
    </div>
  );
}

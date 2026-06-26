import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { useTransferStore } from "@/stores/transfer-store";
import { closeSession } from "@/lib/tauri-terminal";
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
import { trustSshHostKey } from "@/lib/tauri-ssh";
import { isHostKeyError, parsePuckError } from "@/lib/puck-error";
import { HostKeyDialog } from "@/components/ssh/host-key-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { HostKeyPrompt } from "@/lib/puck-error";

type FileManagerProps = {
  sessionId: string;
  profileId?: string;
  active: boolean;
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatModified(timestamp?: number) {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleString();
}

function joinRemotePath(base: string, name: string) {
  if (base === "/") return `/${name}`;
  return `${base.replace(/\/$/, "")}/${name}`;
}

export function FileManager({ sessionId, profileId, active }: FileManagerProps) {
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

  const breadcrumbs = useMemo(() => {
    if (cwd === "/") return ["/"];
    return ["/", ...cwd.split("/").filter(Boolean)];
  }, [cwd]);

  const refresh = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listRemoteDir(sessionId, cwd);
      setEntries(list.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name)));
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
    try {
      await openFileConnection(profileToFileRequest(sessionId, profile));
      setConnected(true);
      const initial = profile.defaultDirectory?.trim() || "/";
      setCwd(initial);
      updateSessionStatus(sessionId, "connected");
    } catch (err) {
      const hostKey = isHostKeyError(err);
      if (hostKey) {
        setHostKeyPrompt(hostKey);
        return;
      }
      updateSessionStatus(sessionId, "failed");
      setError(parsePuckError(err).message);
    }
  }, [profile, sessionId, supported, updateSessionStatus]);

  useEffect(() => {
    if (!profile || !supported) return;

    let disposed = false;
    void (async () => {
      if (disposed) return;
      await connect();
    })();

    return () => {
      disposed = true;
      void closeSession(sessionId);
    };
  }, [connect, profile, sessionId, supported]);

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
        "absolute inset-0 flex min-h-0 flex-col",
        !active && "pointer-events-none invisible",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
          {breadcrumbs.map((segment, index) => {
            const path =
              segment === "/"
                ? "/"
                : `/${breadcrumbs.slice(1, index + 1).join("/")}`;
            return (
              <div key={`${segment}-${index}`} className="flex items-center gap-1">
                {index > 0 ? (
                  <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                ) : null}
                <button
                  type="button"
                  className="rounded px-1 hover:bg-muted"
                  onClick={() => navigateTo(path)}
                >
                  {segment}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={!connected}>
            <RefreshCwIcon className="size-4" />
            {t("common:actions.refresh")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleMkdir()} disabled={!connected}>
            <FolderPlusIcon className="size-4" />
            {t("files:actions.newFolder")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleUpload()} disabled={!connected}>
            <UploadIcon className="size-4" />
            {t("files:actions.upload")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleDownload()} disabled={!selectedPath}>
            {t("files:actions.download")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRenaming(true);
              if (selectedPath) {
                setRenameValue(selectedPath.split("/").pop() ?? "");
              }
            }}
            disabled={!selectedPath}
          >
            {t("files:actions.rename")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleDelete()} disabled={!selectedPath}>
            <Trash2Icon className="size-4" />
            {t("common:actions.delete")}
          </Button>
        </div>
      </div>

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

      <ScrollArea className="min-h-0 flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t("files:columns.name")}</th>
              <th className="px-3 py-2 font-medium">{t("files:columns.size")}</th>
              <th className="px-3 py-2 font-medium">{t("files:columns.modified")}</th>
              <th className="px-3 py-2 font-medium">{t("files:columns.permissions")}</th>
            </tr>
          </thead>
          <tbody>
            {cwd !== "/" ? (
              <tr
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => {
                  const parent =
                    cwd === "/" ? "/" : cwd.replace(/\/[^/]+$/, "") || "/";
                  navigateTo(parent);
                }}
              >
                <td className="px-3 py-2" colSpan={4}>
                  ..
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={4}>
                  {t("files:loading")}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.path}
                  className={cn(
                    "cursor-pointer hover:bg-muted/40",
                    selectedPath === entry.path && "bg-muted/60",
                  )}
                  onClick={() => handleEntryOpen(entry)}
                  onDoubleClick={() => {
                    if (entry.isDir) handleEntryOpen(entry);
                  }}
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      {entry.isDir ? (
                        <FolderIcon className="size-4 text-sky-500" />
                      ) : null}
                      {entry.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.isDir ? "—" : formatBytes(entry.size)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatModified(entry.modified)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.permissions ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollArea>

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

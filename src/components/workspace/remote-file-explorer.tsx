import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  FilePlusIcon,
  FolderPlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { FileTree, type FileTreeEntry } from "@/components/workspace/file-tree";
import {
  deleteRemote,
  listRemoteDir,
  mkdirRemote,
  renameRemote,
  writeRemoteFile,
  type RemoteFileEntry,
} from "@/lib/tauri-sftp";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { parsePuckError } from "@/lib/puck-error";
import { getRemoteExplorerCwd } from "@/lib/remote-explorer-path";
import {
  ensureSftpExplorerSession,
  explorerSftpSessionId,
} from "@/lib/sftp-explorer-session";
import { openFileInWorkbench } from "@/lib/open-in-workbench";
import { shortenPath } from "@/lib/session-display";
import { cdTerminalSession } from "@/lib/terminal-cd";
import {
  breadcrumbPath,
  buildBreadcrumbs,
  joinRemotePath,
  parentRemotePath,
  sortRemoteEntries,
} from "@/lib/remote-path";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Session } from "@/types/connection";

function filterRemoteEntries(
  entries: RemoteFileEntry[],
  showHidden: boolean,
): RemoteFileEntry[] {
  return entries.filter((entry) => {
    if (entry.name === "." || entry.name === "..") return false;
    if (!showHidden && entry.name.startsWith(".")) return false;
    return true;
  });
}

function toTreeEntries(entries: RemoteFileEntry[]): FileTreeEntry[] {
  return entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    isDir: entry.isDir,
    size: entry.size,
  }));
}

/**
 * Remote SFTP file explorer bound to a workspace or SSH terminal cwd.
 *
 * 远程文件树：绑定 Workspace（或兼容终端）目录，双击目录进入，点击箭头展开
 * 子目录，并提供远程新建 / 重命名 / 删除操作。
 */
export function RemoteFileExplorerPanel({
  activeSession,
}: {
  activeSession: Session;
}) {
  const { t } = useTranslation(["info", "common"]);
  const profile = useConnectionStore((state) =>
    activeSession.profileId ? state.getProfile(activeSession.profileId) : undefined,
  );
  const liveSession = useSessionStore(
    (state) =>
      state.sessions.find((item) => item.id === activeSession.id) ??
      activeSession,
  );
  const sessionStatus = liveSession.status;
  const sftpSessionId = explorerSftpSessionId(activeSession.id);
  const terminalCwd = getRemoteExplorerCwd(liveSession, profile);

  const [cwd, setCwd] = useState(terminalCwd);
  const [entries, setEntries] = useState<FileTreeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setCwd((current) => (current === terminalCwd ? current : terminalCwd));
  }, [terminalCwd, activeSession.id]);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(cwd), [cwd]);

  const refresh = useCallback(async () => {
    if (!profile) {
      setError(t("filesRemoteNoProfile"));
      return;
    }

    setLoading(true);
    setError(null);
    setConnecting(true);
    try {
      await ensureSftpExplorerSession(activeSession.id, profile);
      const list = await listRemoteDir(sftpSessionId, cwd);
      setEntries(
        toTreeEntries(filterRemoteEntries(sortRemoteEntries(list), showHidden)),
      );
    } catch (err) {
      const message = parsePuckError(err).message;
      if (message === "cancelled") {
        setError(t("filesRemoteCancelled"));
      } else {
        setError(message);
      }
      setEntries([]);
    } finally {
      setConnecting(false);
      setLoading(false);
    }
  }, [activeSession.id, cwd, profile, showHidden, sftpSessionId, t]);

  useEffect(() => {
    if (sessionStatus !== "connected" && sessionStatus !== "creating") {
      return;
    }
    void refresh();
  }, [cwd, activeSession.id, profile?.id, sessionStatus, refresh]);

  const navigateTo = useCallback(
    (path: string) => {
      setCwd(path);
      const terminalExists = useSessionStore
        .getState()
        .sessions.some((session) => session.id === activeSession.id);
      if (terminalExists) {
        void cdTerminalSession(activeSession.id, path).catch((err) => {
          setError(parsePuckError(err).message);
        });
      }
    },
    [activeSession.id],
  );

  const loadChildren = useCallback(
    async (path: string) => {
      if (!profile) {
        throw new Error(t("filesRemoteNoProfile"));
      }
      try {
        await ensureSftpExplorerSession(activeSession.id, profile);
        const list = await listRemoteDir(sftpSessionId, path);
        return toTreeEntries(
          filterRemoteEntries(sortRemoteEntries(list), showHidden),
        );
      } catch (err) {
        throw new Error(parsePuckError(err).message);
      }
    },
    [activeSession.id, profile, showHidden, sftpSessionId, t],
  );

  const createEntry = useCallback(
    async (kind: "file" | "directory") => {
      if (!profile) return;
      const label = kind === "file"
        ? t("common:workspace.newFileName")
        : t("common:workspace.newFolderName");
      const name = window.prompt(label);
      if (!name?.trim()) return;
      const path = joinRemotePath(cwd, name.trim());
      try {
        await ensureSftpExplorerSession(activeSession.id, profile);
        if (kind === "file") {
          await writeRemoteFile(sftpSessionId, path, "");
        } else {
          await mkdirRemote(sftpSessionId, path);
        }
        await refresh();
      } catch (err) {
        setError(parsePuckError(err).message);
      }
    },
    [activeSession.id, cwd, profile, refresh, sftpSessionId, t],
  );

  const renameEntry = useCallback(
    async (entry: FileTreeEntry) => {
      if (!profile) return;
      const name = window.prompt(
        t("common:workspace.renamePrompt"),
        entry.name,
      );
      if (!name?.trim() || name.trim() === entry.name) return;
      const target = joinRemotePath(parentRemotePath(entry.path), name.trim());
      try {
        await ensureSftpExplorerSession(activeSession.id, profile);
        await renameRemote(sftpSessionId, entry.path, target);
        await refresh();
      } catch (err) {
        setError(parsePuckError(err).message);
      }
    },
    [activeSession.id, profile, refresh, sftpSessionId, t],
  );

  const deleteEntry = useCallback(
    async (entry: FileTreeEntry) => {
      if (!profile) return;
      if (!window.confirm(t("common:workspace.deleteConfirm", { name: entry.name }))) {
        return;
      }
      try {
        await ensureSftpExplorerSession(activeSession.id, profile);
        await deleteRemote(sftpSessionId, entry.path);
        await refresh();
      } catch (err) {
        setError(parsePuckError(err).message);
      }
    },
    [activeSession.id, profile, refresh, sftpSessionId, t],
  );

  if (!profile) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        {t("filesRemoteNoProfile")}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        <ScrollArea className="min-w-0 flex-1 whitespace-nowrap">
          <div className="flex items-center gap-0.5 text-xs">
            {breadcrumbs.map((segment, index) => (
              <div key={`${segment}-${index}`} className="inline-flex items-center">
                {index > 0 ? (
                  <ChevronRightIcon className="mx-0.5 size-3 text-muted-foreground" />
                ) : null}
                <button
                  type="button"
                  className="rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  onClick={() =>
                    navigateTo(breadcrumbPath(breadcrumbs, index))
                  }
                >
                  {segment === "/" ? "/" : segment}
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  showHidden ? t("hideHiddenFiles") : t("showHiddenFiles")
                }
                aria-pressed={showHidden}
                className={cn(showHidden && "text-foreground")}
                onClick={() => setShowHidden((visible) => !visible)}
              >
                {showHidden ? <EyeIcon /> : <EyeOffIcon />}
              </Button>
            }
          />
          <TooltipContent side="bottom">
            {showHidden ? t("hideHiddenFiles") : t("showHiddenFiles")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("common:workspace.newFile")}
                onClick={() => void createEntry("file")}
              >
                <FilePlusIcon />
              </Button>
            }
          />
          <TooltipContent side="bottom">{t("common:workspace.newFile")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("common:workspace.newFolder")}
                onClick={() => void createEntry("directory")}
              >
                <FolderPlusIcon />
              </Button>
            }
          />
          <TooltipContent side="bottom">{t("common:workspace.newFolder")}</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("refresh")}
          disabled={loading || connecting}
          onClick={() => void refresh()}
        >
          <RefreshCwIcon className={cn((loading || connecting) && "animate-spin")} />
        </Button>
      </div>

      {error ? (
        <div className="px-3 py-2 text-xs text-destructive">{error}</div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <FileTree
          entries={entries}
          loading={loading || connecting}
          emptyLabel={t("emptyDirectory")}
          cacheKey={`${activeSession.id}:${cwd}:${showHidden}`}
          loadChildren={loadChildren}
          onEnterDirectory={navigateTo}
          onOpenFile={(path) => {
            void (async () => {
              try {
                await ensureSftpExplorerSession(activeSession.id, profile);
                openFileInWorkbench({
                  path,
                  source: "remote",
                  sessionId: sftpSessionId,
                  profile,
                });
              } catch (err) {
                setError(parsePuckError(err).message);
              }
            })();
          }}
          onRename={(entry) => void renameEntry(entry)}
          onDelete={(entry) => void deleteEntry(entry)}
          renameLabel={t("common:workspace.rename")}
          deleteLabel={t("common:workspace.delete")}
        />
      </ScrollArea>

      <div className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
        <div className="truncate">{shortenPath(cwd)}</div>
      </div>
    </div>
  );
}

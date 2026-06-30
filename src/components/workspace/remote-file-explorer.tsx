import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  FileIcon,
  FolderIcon,
  RefreshCwIcon,
} from "lucide-react";
import { listRemoteDir, type RemoteFileEntry } from "@/lib/tauri-sftp";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { parsePuckError } from "@/lib/puck-error";
import { getRemoteExplorerCwd } from "@/lib/remote-explorer-path";
import {
  ensureSftpExplorerSession,
  explorerSftpSessionId,
} from "@/lib/sftp-explorer-session";
import { shortenPath } from "@/lib/session-display";
import { openEditorWindow } from "@/lib/open-editor-window";
import {
  breadcrumbPath,
  buildBreadcrumbs,
  formatBytes,
  sortRemoteEntries,
} from "@/page/files/file-manager/utils";
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

export function RemoteFileExplorerPanel({
  activeSession,
}: {
  activeSession: Session;
}) {
  const { t } = useTranslation("info");
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
  const [entries, setEntries] = useState<RemoteFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setCwd(terminalCwd);
  }, [terminalCwd, activeSession.id]);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(cwd), [cwd]);
  const visibleEntries = useMemo(
    () => filterRemoteEntries(entries, showHidden),
    [entries, showHidden],
  );

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
      setEntries(sortRemoteEntries(list));
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
  }, [activeSession.id, cwd, profile, sftpSessionId, t]);

  useEffect(() => {
    if (sessionStatus !== "connected" && sessionStatus !== "creating") {
      return;
    }
    void refresh();
  }, [cwd, activeSession.id, profile?.id, sessionStatus, refresh]);

  const navigateTo = (path: string) => {
    setCwd(path);
  };

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
                  onClick={() => navigateTo(breadcrumbPath(breadcrumbs, index))}
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
        <div className="py-1">
          {cwd !== "/" ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={() => {
                const parent = cwd.replace(/\/[^/]+$/, "") || "/";
                navigateTo(parent);
              }}
            >
              <FolderIcon className="size-3.5 shrink-0 opacity-70" />
              <span>..</span>
            </button>
          ) : null}

          {visibleEntries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50",
                entry.name.startsWith(".") && "text-muted-foreground",
              )}
              onClick={() => {
                if (entry.isDir) {
                  navigateTo(entry.path);
                }
              }}
              onDoubleClick={() => {
                if (entry.isDir || !profile) return;
                void (async () => {
                  try {
                    await ensureSftpExplorerSession(activeSession.id, profile);
                    await openEditorWindow({
                      path: entry.path,
                      source: "remote",
                      sessionId: sftpSessionId,
                    });
                  } catch (err) {
                    setError(parsePuckError(err).message);
                  }
                })();
              }}
            >
              {entry.isDir ? (
                <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              {!entry.isDir ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(entry.size)}
                </span>
              ) : null}
            </button>
          ))}

          {!loading && !connecting && visibleEntries.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("emptyDirectory")}
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
        <div className="truncate">{shortenPath(cwd)}</div>
        <div className="text-[10px] opacity-70">{t("filesRemoteFollowCwd")}</div>
      </div>
    </div>
  );
}

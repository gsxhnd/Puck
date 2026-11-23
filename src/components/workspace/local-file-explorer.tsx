import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  FilePlusIcon,
  FolderPlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SquareTerminalIcon,
  XIcon,
} from "lucide-react";
import {
  FileTree,
  FileSearchResults,
  type FileTreeEntry,
  type FileTreeMenuLabels,
} from "@/components/workspace/file-tree";
import {
  deleteLocal,
  listLocalDir,
  mkdirLocal,
  renameLocal,
  writeLocalFile,
} from "@/lib/tauri-workspace";
import { getWorkspacePath } from "@/lib/use-active-local-session";
import { parsePuckError } from "@/lib/puck-error";
import { joinLocalPath, parentLocalPath, splitLocalPath } from "@/lib/local-path";
import { openFileInWorkbench } from "@/lib/open-in-workbench";
import { shortenPath } from "@/lib/session-display";
import { cdTerminalSession } from "@/lib/terminal-cd";
import { useWorkspaceWatch } from "@/hooks/use-workspace-watch";
import { useFileNameSearch } from "@/hooks/use-file-name-search";
import { useSessionStore } from "@/stores/session-store";
import type { Session } from "@/types/connection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LocalFileEntry } from "@/types/workspace";

function toTreeEntries(entries: LocalFileEntry[]): FileTreeEntry[] {
  return entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    isDir: entry.isDir,
    size: entry.size,
  }));
}

/**
 * Local file explorer bound to the active terminal working directory.
 *
 * 本地文件树：跟随终端 cwd，双击目录进入并同步 `cd`，点击箭头展开子目录。
 */
export function LocalFileExplorerPanel({
  activeSession,
}: {
  activeSession: Session;
}) {
  const { t } = useTranslation(["info", "common"]);
  const workspacePath = getWorkspacePath(activeSession);
  const [cwd, setCwd] = useState(workspacePath);
  const [entries, setEntries] = useState<FileTreeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setCwd((current) => (current === workspacePath ? current : workspacePath));
  }, [workspacePath, activeSession.id]);

  const breadcrumbs = useMemo(() => splitLocalPath(cwd), [cwd]);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const list = await listLocalDir(cwd, showHidden);
        setEntries(toTreeEntries(list));
      } catch (err) {
        setError(parsePuckError(err).message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [cwd, showHidden],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the listing in sync with on-disk changes (file saves, git
  // operations) without flickering the loading state.
  // 磁盘变化（保存/ git 操作）时静默刷新列表，避免 loading 闪烁。
  useWorkspaceWatch(cwd, () => {
    void refresh(true);
  });

  const openTerminalHere = useCallback(() => {
    useSessionStore.getState().addSession({
      kind: "terminal",
      title: "__local__",
      protocol: "local",
      cwd,
      workspaceId: activeSession.workspaceId,
    });
  }, [cwd]);

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

  const resolveBreadcrumbPath = (index: number) => {
    if (breadcrumbs[0] === "~") {
      if (index === 0) return "~";
      return joinLocalPath("~", ...breadcrumbs.slice(1, index + 1));
    }
    if (breadcrumbs[0] === "/") {
      if (index === 0) return "/";
      return joinLocalPath("/", ...breadcrumbs.slice(1, index + 1));
    }
    return joinLocalPath(...breadcrumbs.slice(0, index + 1));
  };

  const loadChildren = useCallback(
    async (path: string) => {
      try {
        const list = await listLocalDir(path, showHidden);
        return toTreeEntries(list);
      } catch (err) {
        throw new Error(parsePuckError(err).message);
      }
    },
    [showHidden],
  );

  const searchListDir = useCallback(
    async (path: string) => {
      const list = await listLocalDir(path, showHidden);
      return toTreeEntries(list);
    },
    [showHidden],
  );

  const search = useFileNameSearch({ root: cwd, query, listDir: searchListDir });

  const createEntry = useCallback(
    async (kind: "file" | "directory", dirPath: string = cwd) => {
      const label = kind === "file"
        ? t("common:workspace.newFileName")
        : t("common:workspace.newFolderName");
      const name = window.prompt(label);
      if (!name?.trim()) return;
      const path = joinLocalPath(dirPath, name.trim());
      try {
        if (kind === "file") {
          await writeLocalFile(path, "");
        } else {
          await mkdirLocal(path);
        }
        await refresh();
      } catch (err) {
        setError(parsePuckError(err).message);
      }
    },
    [cwd, refresh, t],
  );

  const renameEntry = useCallback(
    async (entry: FileTreeEntry) => {
      const name = window.prompt(
        t("common:workspace.renamePrompt"),
        entry.name,
      );
      if (!name?.trim() || name.trim() === entry.name) return;
      const target = joinLocalPath(parentLocalPath(entry.path), name.trim());
      try {
        await renameLocal(entry.path, target);
        await refresh();
      } catch (err) {
        setError(parsePuckError(err).message);
      }
    },
    [refresh, t],
  );

  const deleteEntry = useCallback(
    async (entry: FileTreeEntry) => {
      if (!window.confirm(t("common:workspace.deleteConfirm", { name: entry.name }))) {
        return;
      }
      try {
        await deleteLocal(entry.path);
        await refresh();
      } catch (err) {
        setError(parsePuckError(err).message);
      }
    },
    [refresh, t],
  );

  const menuLabels = useMemo<FileTreeMenuLabels>(
    () => ({
      open: t("common:actions.open"),
      copyPath: t("common:workspace.copyPath"),
      newFile: t("common:workspace.newFile"),
      newFolder: t("common:workspace.newFolder"),
      pathCopied: t("common:workspace.pathCopied"),
    }),
    [t],
  );

  const openInWorkbench = useCallback(
    (path: string) => {
      openFileInWorkbench({ path, source: "local" });
    },
    [],
  );

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
                  onClick={() => navigateTo(resolveBreadcrumbPath(index))}
                >
                  {segment}
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("openTerminalHere")}
                onClick={openTerminalHere}
              >
                <SquareTerminalIcon />
              </Button>
            }
          />
          <TooltipContent side="bottom">
            {t("openTerminalHere")}
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("refresh")}
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCwIcon className={cn(loading && "animate-spin")} />
        </Button>
      </div>

      <div className="relative border-b border-border/60 px-2 py-1.5">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("common:workspace.searchPlaceholder")}
          className="h-7 pl-7 pr-7 text-xs md:text-xs"
        />
        {query ? (
          <button
            type="button"
            aria-label={t("common:actions.close")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setQuery("")}
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="px-3 py-2 text-xs text-destructive">{error}</div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        {query.trim() ? (
          <FileSearchResults
            results={search.results}
            rootPath={cwd}
            searching={search.searching}
            truncated={search.truncated}
            emptyLabel={t("common:workspace.searchNoResults")}
            truncatedLabel={t("common:workspace.searchTruncated")}
            onEnterDirectory={(path) => {
              navigateTo(path);
              setQuery("");
            }}
            onOpenFile={openInWorkbench}
            onRename={(entry) => void renameEntry(entry)}
            onDelete={(entry) => void deleteEntry(entry)}
            onCreateIn={(kind, dirPath) => void createEntry(kind, dirPath)}
            menuLabels={menuLabels}
            renameLabel={t("common:workspace.rename")}
            deleteLabel={t("common:workspace.delete")}
          />
        ) : (
          <FileTree
            entries={entries}
            loading={loading}
            emptyLabel={t("emptyDirectory")}
            cacheKey={`${activeSession.id}:${cwd}:${showHidden}`}
            loadChildren={loadChildren}
            onEnterDirectory={navigateTo}
            onOpenFile={openInWorkbench}
            onRename={(entry) => void renameEntry(entry)}
            onDelete={(entry) => void deleteEntry(entry)}
            onCreateIn={(kind, dirPath) => void createEntry(kind, dirPath)}
            menuLabels={menuLabels}
            renameLabel={t("common:workspace.rename")}
            deleteLabel={t("common:workspace.delete")}
          />
        )}
      </ScrollArea>

      <div className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
        <div className="truncate">{shortenPath(cwd)}</div>
      </div>
    </div>
  );
}

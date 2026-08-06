import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshCwIcon,
} from "lucide-react";
import { FileTree, type FileTreeEntry } from "@/components/workspace/file-tree";
import { listLocalDir } from "@/lib/tauri-workspace";
import { getWorkspacePath } from "@/lib/use-active-local-session";
import { parsePuckError } from "@/lib/puck-error";
import { joinLocalPath, splitLocalPath } from "@/lib/local-path";
import { openEditorWindow } from "@/lib/open-editor-window";
import { shortenPath } from "@/lib/session-display";
import { cdTerminalSession } from "@/lib/terminal-cd";
import type { Session } from "@/types/connection";
import { Button } from "@/components/ui/button";
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
  const { t } = useTranslation("info");
  const workspacePath = getWorkspacePath(activeSession);
  const [cwd, setCwd] = useState(workspacePath);
  const [entries, setEntries] = useState<FileTreeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setCwd((current) => (current === workspacePath ? current : workspacePath));
  }, [workspacePath, activeSession.id]);

  const breadcrumbs = useMemo(() => splitLocalPath(cwd), [cwd]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listLocalDir(cwd, showHidden);
      setEntries(toTreeEntries(list));
    } catch (err) {
      setError(parsePuckError(err).message);
    } finally {
      setLoading(false);
    }
  }, [cwd, showHidden]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const navigateTo = useCallback(
    (path: string) => {
      setCwd(path);
      void cdTerminalSession(activeSession.id, path).catch((err) => {
        setError(parsePuckError(err).message);
      });
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

      {error ? (
        <div className="px-3 py-2 text-xs text-destructive">{error}</div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <FileTree
          entries={entries}
          loading={loading}
          emptyLabel={t("emptyDirectory")}
          cacheKey={`${activeSession.id}:${cwd}:${showHidden}`}
          loadChildren={loadChildren}
          onEnterDirectory={navigateTo}
          onOpenFile={(path) => {
            void openEditorWindow({ path, source: "local" });
          }}
        />
      </ScrollArea>

      <div className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
        <div className="truncate">{shortenPath(cwd)}</div>
        <div className="text-[10px] opacity-70">{t("filesFollowCwd")}</div>
      </div>
    </div>
  );
}

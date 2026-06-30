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
import { listLocalDir } from "@/lib/tauri-workspace";
import { getWorkspacePath } from "@/lib/use-active-local-session";
import { parsePuckError } from "@/lib/puck-error";
import { shortenPath } from "@/lib/session-display";
import type { Session } from "@/types/connection";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { openEditorWindow } from "@/lib/open-editor-window";
import type { LocalFileEntry } from "@/types/workspace";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function LocalFileExplorerPanel({
  activeSession,
}: {
  activeSession: Session;
}) {
  const { t } = useTranslation("info");
  const workspacePath = getWorkspacePath(activeSession);
  const [cwd, setCwd] = useState(workspacePath);
  const [entries, setEntries] = useState<LocalFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setCwd(workspacePath);
  }, [workspacePath, activeSession.id]);

  const breadcrumbs = useMemo(() => {
    if (cwd === "~") return ["~"];
    if (cwd.startsWith("~/")) {
      return ["~", ...cwd.slice(2).split("/").filter(Boolean)];
    }
    if (cwd === "/") return ["/"];
    return ["/", ...cwd.split("/").filter(Boolean)];
  }, [cwd]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listLocalDir(cwd, showHidden);
      setEntries(list);
    } catch (err) {
      setError(parsePuckError(err).message);
    } finally {
      setLoading(false);
    }
  }, [cwd, showHidden]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const navigateTo = (path: string) => {
    setCwd(path);
  };

  const resolveBreadcrumbPath = (index: number) => {
    if (breadcrumbs[0] === "~") {
      if (index === 0) return "~";
      return `~/${breadcrumbs.slice(1, index + 1).join("/")}`;
    }
    if (breadcrumbs[0] === "/") {
      if (index === 0) return "/";
      return `/${breadcrumbs.slice(1, index + 1).join("/")}`;
    }
    return breadcrumbs.slice(0, index + 1).join("/");
  };

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
        <div className="py-1">
          {cwd !== "~" && cwd !== "/" ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={() => {
                if (cwd.startsWith("~/")) {
                  const parent = cwd.replace(/\/[^/]+$/, "");
                  navigateTo(parent === "~" ? "~" : parent || "~");
                  return;
                }
                const parent = cwd.replace(/\/[^/]+$/, "") || "/";
                navigateTo(parent);
              }}
            >
              <FolderIcon className="size-3.5 shrink-0 opacity-70" />
              <span>..</span>
            </button>
          ) : null}

          {entries.map((entry) => (
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
                if (!entry.isDir) {
                  void openEditorWindow({ path: entry.path, source: "local" });
                }
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

          {!loading && entries.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("emptyDirectory")}
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
        {shortenPath(cwd)}
      </div>
    </div>
  );
}

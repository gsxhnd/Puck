import { useCallback, useEffect, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FileTreeEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

type FileTreeNodeProps = {
  entry: FileTreeEntry;
  depth: number;
  loadChildren: (path: string) => Promise<FileTreeEntry[]>;
  onEnterDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
  cacheKey: string;
};

function FileTreeNode({
  entry,
  depth,
  loadChildren,
  onEnterDirectory,
  onOpenFile,
  cacheKey,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileTreeEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExpanded(false);
    setChildren(null);
    setError(null);
    setLoading(false);
  }, [cacheKey, entry.path]);

  const toggleExpand = useCallback(async () => {
    if (!entry.isDir) return;

    if (expanded) {
      setExpanded(false);
      return;
    }

    if (children) {
      setExpanded(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await loadChildren(entry.path);
      setChildren(next);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [children, entry.isDir, entry.path, expanded, loadChildren]);

  return (
    <div>
      <div
        className={cn(
          "file-list-row flex w-full items-center gap-1 py-1 pr-3 text-sm transition-colors hover:bg-muted/50",
          entry.name.startsWith(".") && "text-muted-foreground",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onDoubleClick={() => {
          if (entry.isDir) {
            onEnterDirectory(entry.path);
            return;
          }
          onOpenFile(entry.path);
        }}
      >
        {entry.isDir ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse" : "Expand"}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void toggleExpand();
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {loading ? (
              <LoaderCircleIcon className="size-3 animate-spin" />
            ) : expanded ? (
              <ChevronDownIcon className="size-3" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
          </button>
        ) : (
          <span className="inline-flex size-4 shrink-0" />
        )}

        {entry.isDir ? (
          expanded ? (
            <FolderOpenIcon className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}

        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
        {!entry.isDir ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatBytes(entry.size)}
          </span>
        ) : null}
      </div>

      {error ? (
        <div
          className="px-3 py-1 text-xs text-destructive"
          style={{ paddingLeft: `${24 + depth * 14}px` }}
        >
          {error}
        </div>
      ) : null}

      {expanded && children
        ? children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              loadChildren={loadChildren}
              onEnterDirectory={onEnterDirectory}
              onOpenFile={onOpenFile}
              cacheKey={cacheKey}
            />
          ))
        : null}
    </div>
  );
}

type FileTreeProps = {
  entries: FileTreeEntry[];
  loading?: boolean;
  emptyLabel: string;
  /** Bump when root cwd changes so expanded nodes reset. */
  cacheKey: string;
  loadChildren: (path: string) => Promise<FileTreeEntry[]>;
  onEnterDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
};

/**
 * Expandable file tree for the sidebar explorer.
 *
 * 侧栏可展开文件树：点击箭头展开子目录，双击目录进入，双击文件打开编辑器。
 */
export function FileTree({
  entries,
  loading = false,
  emptyLabel,
  cacheKey,
  loadChildren,
  onEnterDirectory,
  onOpenFile,
}: FileTreeProps) {
  if (!loading && entries.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="py-1">
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          loadChildren={loadChildren}
          onEnterDirectory={onEnterDirectory}
          onOpenFile={onOpenFile}
          cacheKey={cacheKey}
        />
      ))}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export type FileTreeEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
};

/** Labels for the optional per-row context menu. 行级右键菜单文案。 */
export type FileTreeMenuLabels = {
  open: string;
  copyPath: string;
  newFile: string;
  newFolder: string;
  pathCopied: string;
};

function fileExtension(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  const name = segments[segments.length - 1] ?? path;
  if (name.startsWith(".") && !name.slice(1).includes(".")) return "";
  const parts = name.split(".");
  return parts[parts.length - 1] ?? "";
}

function FileBadge({ path }: { path: string }) {
  const extension = fileExtension(path);
  if (!extension) return null;
  return (
    <span className="flex h-4 shrink-0 items-center rounded bg-primary/10 px-1 text-[8px] font-semibold uppercase text-primary">
      {extension.slice(0, 4)}
    </span>
  );
}

function parentPathOf(entry: FileTreeEntry): string {
  return entry.path.length > entry.name.length
    ? entry.path.slice(0, entry.path.length - entry.name.length - 1)
    : entry.path;
}

/**
 * Directory portion of a path relative to the search root, used as the
 * secondary line of search result rows.
 * 搜索结果行展示的目录部分：相对搜索根目录，无法相对时退回完整路径。
 */
function relativeDirPath(path: string, root: string, name: string): string {
  const normalizedRoot = root.replace(/[\\/]+$/, "");
  let dir = path;
  if (
    path.startsWith(`${normalizedRoot}/`) ||
    path.startsWith(`${normalizedRoot}\\`)
  ) {
    dir = path.slice(normalizedRoot.length + 1);
  }
  if (
    dir === name ||
    dir.endsWith(`/${name}`) ||
    dir.endsWith(`\\${name}`)
  ) {
    dir = dir.slice(0, dir.length - name.length - 1);
  }
  return dir;
}

type FileRowMenuProps = {
  entry: FileTreeEntry;
  menuLabels: FileTreeMenuLabels;
  renameLabel: string;
  deleteLabel: string;
  onOpenFile: (path: string) => void;
  onRename?: (entry: FileTreeEntry) => void;
  onDelete?: (entry: FileTreeEntry) => void;
  onCreateIn?: (kind: "file" | "directory", dirPath: string) => void;
};

function FileRowContextMenuContent({
  entry,
  menuLabels,
  renameLabel,
  deleteLabel,
  onOpenFile,
  onRename,
  onDelete,
  onCreateIn,
}: FileRowMenuProps) {
  const createDir = entry.isDir ? entry.path : parentPathOf(entry);
  return (
    <ContextMenuContent>
      {!entry.isDir ? (
        <ContextMenuItem onClick={() => onOpenFile(entry.path)}>
          {menuLabels.open}
        </ContextMenuItem>
      ) : null}
      <ContextMenuItem
        onClick={() => {
          void navigator.clipboard
            .writeText(entry.path)
            .then(() => toast.success(menuLabels.pathCopied))
            .catch(() => toast.error(menuLabels.pathCopied));
        }}
      >
        {menuLabels.copyPath}
      </ContextMenuItem>
      {onCreateIn ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onCreateIn("file", createDir)}>
            {menuLabels.newFile}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreateIn("directory", createDir)}>
            {menuLabels.newFolder}
          </ContextMenuItem>
        </>
      ) : null}
      {onRename || onDelete ? <ContextMenuSeparator /> : null}
      {onRename ? (
        <ContextMenuItem onClick={() => onRename(entry)}>
          {renameLabel}
        </ContextMenuItem>
      ) : null}
      {onDelete ? (
        <ContextMenuItem variant="destructive" onClick={() => onDelete(entry)}>
          {deleteLabel}
        </ContextMenuItem>
      ) : null}
    </ContextMenuContent>
  );
}

type FileTreeNodeProps = {
  entry: FileTreeEntry;
  depth: number;
  loadChildren: (path: string) => Promise<FileTreeEntry[]>;
  onEnterDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
  onRename?: (entry: FileTreeEntry) => void;
  onDelete?: (entry: FileTreeEntry) => void;
  onCreateIn?: (kind: "file" | "directory", dirPath: string) => void;
  menuLabels?: FileTreeMenuLabels;
  renameLabel: string;
  deleteLabel: string;
  cacheKey: string;
};

function FileTreeNode({
  entry,
  depth,
  loadChildren,
  onEnterDirectory,
  onOpenFile,
  onRename,
  onDelete,
  onCreateIn,
  menuLabels,
  renameLabel,
  deleteLabel,
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

  const row = (
    <div
      className={cn(
        "file-list-row group flex h-8 w-full items-center gap-1.5 py-0 pr-2 text-sm transition-colors hover:bg-muted/50",
        entry.name.startsWith(".") && "text-muted-foreground",
      )}
      style={{ paddingLeft: `${10 + depth * 14}px` }}
      onClick={() => {
        if (!entry.isDir) onOpenFile(entry.path);
      }}
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
          <FolderOpenIcon className="size-3.5 shrink-0 text-primary" />
        ) : (
          <FolderIcon className="size-3.5 shrink-0 text-primary" />
        )
      ) : (
        <span className="w-3.5 shrink-0" />
      )}

      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      {!entry.isDir ? <FileBadge path={entry.path} /> : null}
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {onRename ? (
          <button
            type="button"
            aria-label={renameLabel}
            title={renameLabel}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onRename(entry);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <PencilIcon className="size-3" />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            aria-label={deleteLabel}
            title={deleteLabel}
            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onDelete(entry);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <Trash2Icon className="size-3" />
          </button>
        ) : null}
      </span>
    </div>
  );

  return (
    <div>
      {menuLabels ? (
        <ContextMenu>
          <ContextMenuTrigger render={row} />
          <FileRowContextMenuContent
            entry={entry}
            menuLabels={menuLabels}
            renameLabel={renameLabel}
            deleteLabel={deleteLabel}
            onOpenFile={onOpenFile}
            onRename={onRename}
            onDelete={onDelete}
            onCreateIn={onCreateIn}
          />
        </ContextMenu>
      ) : (
        row
      )}

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
              onRename={onRename}
              onDelete={onDelete}
              onCreateIn={onCreateIn}
              menuLabels={menuLabels}
              renameLabel={renameLabel}
              deleteLabel={deleteLabel}
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
  onRename?: (entry: FileTreeEntry) => void;
  onDelete?: (entry: FileTreeEntry) => void;
  /** Enables "New File / New Folder" in row context menus. */
  onCreateIn?: (kind: "file" | "directory", dirPath: string) => void;
  /** Enables the per-row context menu. */
  menuLabels?: FileTreeMenuLabels;
  renameLabel: string;
  deleteLabel: string;
};

/**
 * Expandable file tree for the sidebar explorer.
 *
 * 侧栏可展开文件树：点击箭头展开子目录，双击目录进入，双击文件打开编辑器，
 * 右键节点弹出打开 / 复制路径 / 新建 / 重命名 / 删除菜单。
 */
export function FileTree({
  entries,
  loading = false,
  emptyLabel,
  cacheKey,
  loadChildren,
  onEnterDirectory,
  onOpenFile,
  onRename,
  onDelete,
  onCreateIn,
  menuLabels,
  renameLabel,
  deleteLabel,
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
          onRename={onRename}
          onDelete={onDelete}
          onCreateIn={onCreateIn}
          menuLabels={menuLabels}
          renameLabel={renameLabel}
          deleteLabel={deleteLabel}
          cacheKey={cacheKey}
        />
      ))}
    </div>
  );
}

type FileSearchResultsProps = {
  results: FileTreeEntry[];
  /** Search root used to render relative directory hints. */
  rootPath: string;
  searching: boolean;
  truncated: boolean;
  emptyLabel: string;
  truncatedLabel: string;
  onEnterDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
  onRename?: (entry: FileTreeEntry) => void;
  onDelete?: (entry: FileTreeEntry) => void;
  onCreateIn?: (kind: "file" | "directory", dirPath: string) => void;
  menuLabels?: FileTreeMenuLabels;
  renameLabel: string;
  deleteLabel: string;
};

/**
 * Flat result list for the file name search; rows share the tree's context
 * menu and open files / enter directories on click.
 *
 * 文件名查询的扁平结果列表：行复用文件树的右键菜单，单击打开文件或进入目录。
 */
export function FileSearchResults({
  results,
  rootPath,
  searching,
  truncated,
  emptyLabel,
  truncatedLabel,
  onEnterDirectory,
  onOpenFile,
  onRename,
  onDelete,
  onCreateIn,
  menuLabels,
  renameLabel,
  deleteLabel,
}: FileSearchResultsProps) {
  if (!searching && results.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="py-1">
      {searching && results.length === 0 ? (
        <div className="flex justify-center py-4">
          <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {results.map((entry) => {
        const dirHint = relativeDirPath(entry.path, rootPath, entry.name);
        const row = (
          <div
            className="file-list-row group flex h-8 w-full items-center gap-1.5 px-2 text-sm transition-colors hover:bg-muted/50"
            onClick={() => {
              if (entry.isDir) onEnterDirectory(entry.path);
              else onOpenFile(entry.path);
            }}
          >
            {entry.isDir ? (
              <FolderIcon className="size-3.5 shrink-0 text-primary" />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate" title={entry.path}>
              {entry.name}
              {dirHint ? (
                <span className="ml-1.5 text-[11px] text-muted-foreground">
                  {dirHint}
                </span>
              ) : null}
            </span>
            {!entry.isDir ? <FileBadge path={entry.path} /> : null}
          </div>
        );
        return (
          <div key={entry.path}>
            {menuLabels ? (
              <ContextMenu>
                <ContextMenuTrigger render={row} />
                <FileRowContextMenuContent
                  entry={entry}
                  menuLabels={menuLabels}
                  renameLabel={renameLabel}
                  deleteLabel={deleteLabel}
                  onOpenFile={onOpenFile}
                  onRename={onRename}
                  onDelete={onDelete}
                  onCreateIn={onCreateIn}
                />
              </ContextMenu>
            ) : (
              row
            )}
          </div>
        );
      })}
      {truncated ? (
        <div className="px-3 py-2 text-center text-[11px] text-muted-foreground">
          {truncatedLabel}
        </div>
      ) : null}
    </div>
  );
}

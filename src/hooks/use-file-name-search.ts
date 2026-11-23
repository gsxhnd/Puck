/**
 * Bounded breadth-first file name search over the workspace tree.
 *
 * 工作区文件名查询：复用现有的目录列举 IPC 做有界广度优先搜索（限深、限结果
 * 数、跳过常见重目录），输入防抖后在侧栏文件树展示扁平结果。
 */
import { useEffect, useState } from "react";
import type { FileTreeEntry } from "@/components/workspace/file-tree";

/** Directories that are skipped while searching. 搜索时跳过的重目录。 */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  "build",
  "out",
  ".next",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  "vendor",
  "Pods",
  "DerivedData",
]);

const MAX_DEPTH = 4;
const MAX_RESULTS = 100;
const DEBOUNCE_MS = 250;

export type FileNameSearchState = {
  results: FileTreeEntry[];
  searching: boolean;
  truncated: boolean;
};

/**
 * Searches file and folder names under `root` while `query` is non-empty.
 * `listDir` must be a stable callback (memoized by the caller).
 *
 * `query` 非空时从 `root` 递归匹配名称；`listDir` 必须是调用方 memoize 过的
 * 稳定回调，目录读取失败（权限等）会被跳过而不是中断整个搜索。
 */
export function useFileNameSearch(options: {
  root: string;
  query: string;
  listDir: (path: string) => Promise<FileTreeEntry[]>;
}): FileNameSearchState {
  const { root, query, listDir } = options;
  const trimmed = query.trim().toLowerCase();
  const [state, setState] = useState<FileNameSearchState>({
    results: [],
    searching: false,
    truncated: false,
  });

  useEffect(() => {
    if (!trimmed) {
      setState({ results: [], searching: false, truncated: false });
      return;
    }

    let cancelled = false;
    setState((current) => ({
      ...current,
      searching: true,
      truncated: false,
    }));

    const timer = window.setTimeout(() => {
      void (async () => {
        const results: FileTreeEntry[] = [];
        let truncated = false;
        const queue: Array<{ path: string; depth: number }> = [
          { path: root, depth: 0 },
        ];
        while (queue.length > 0 && results.length < MAX_RESULTS) {
          const next = queue.shift();
          if (!next) break;
          let children: FileTreeEntry[];
          try {
            children = await listDir(next.path);
          } catch {
            // Unreadable directories (permissions, races) are skipped.
            // 无法读取的目录直接跳过。
            continue;
          }
          for (const child of children) {
            if (cancelled) return;
            if (child.name.toLowerCase().includes(trimmed)) {
              if (results.length >= MAX_RESULTS) {
                truncated = true;
                break;
              }
              results.push(child);
            }
            if (
              child.isDir &&
              next.depth < MAX_DEPTH &&
              !child.name.startsWith(".") &&
              !SKIP_DIRS.has(child.name)
            ) {
              queue.push({ path: child.path, depth: next.depth + 1 });
            }
          }
        }
        if (!cancelled) {
          setState({ results, searching: false, truncated });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [listDir, root, trimmed]);

  return state;
}

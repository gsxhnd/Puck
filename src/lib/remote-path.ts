/**
 * Pure helpers for remote POSIX-style workspace paths.
 *
 * 远端 POSIX 路径的纯函数工具：面包屑、路径拼接、排序与展示格式化。
 */
import type { RemoteFileEntry } from "@/lib/tauri-sftp";

/** Human-readable byte size for remote files. / 远端文件大小的人类可读格式。 */
export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Unix timestamp (seconds) to locale string, or em dash when missing. / 秒级时间戳转本地时间。 */
export function formatModified(timestamp?: number) {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleString();
}

/** Joins a remote directory path with a child name. / 拼接远端目录与子项名称。 */
export function joinRemotePath(base: string, name: string) {
  if (base === "/") return `/${name}`;
  return `${base.replace(/\/$/, "")}/${name}`;
}

/** Returns the parent directory of a remote path. / 返回远端路径的父目录。 */
export function parentRemotePath(path: string) {
  const parent = path.replace(/\/[^/]+$/, "");
  return parent === "" ? "/" : parent;
}

/** Builds breadcrumb segments from a remote cwd path. / 从远端 cwd 构建面包屑。 */
export function buildBreadcrumbs(cwd: string) {
  if (cwd === "/") return ["/"];
  return ["/", ...cwd.split("/").filter(Boolean)];
}

/** Resolves a breadcrumb segment index to an absolute remote path. / 面包屑索引转绝对路径。 */
export function breadcrumbPath(breadcrumbs: string[], index: number) {
  const segment = breadcrumbs[index];
  if (segment === "/") return "/";
  return `/${breadcrumbs.slice(1, index + 1).join("/")}`;
}

/** Sorts directories before files, then alphabetically. / 目录优先，名称字母序排序。 */
export function sortRemoteEntries(entries: RemoteFileEntry[]) {
  return [...entries].sort(
    (a, b) =>
      Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
  );
}

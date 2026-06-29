import type { RemoteFileEntry } from "@/lib/tauri-sftp";

/** Human-readable byte size for the remote file table. */
export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Unix timestamp (seconds) to locale string, or em dash when missing. */
export function formatModified(timestamp?: number) {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleString();
}

/** Join a remote directory path with a child name. */
export function joinRemotePath(base: string, name: string) {
  if (base === "/") return `/${name}`;
  return `${base.replace(/\/$/, "")}/${name}`;
}

/** Build breadcrumb segments from a remote cwd path. */
export function buildBreadcrumbs(cwd: string) {
  if (cwd === "/") return ["/"];
  return ["/", ...cwd.split("/").filter(Boolean)];
}

/** Resolve a breadcrumb segment index to an absolute remote path. */
export function breadcrumbPath(breadcrumbs: string[], index: number) {
  const segment = breadcrumbs[index];
  if (segment === "/") return "/";
  return `/${breadcrumbs.slice(1, index + 1).join("/")}`;
}

/** Sort directories before files, then alphabetically by name. */
export function sortRemoteEntries(entries: RemoteFileEntry[]) {
  return [...entries].sort(
    (a, b) =>
      Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
  );
}

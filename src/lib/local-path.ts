/**
 * Local filesystem path helpers for Windows and Unix.
 *
 * 本地路径拆分、父目录与拼接，兼容 Windows 反斜杠与 Unix 正斜杠。
 */

function isWindowsAbsolute(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

function normalizeSeparators(path: string): string {
  if (path.includes("\\")) {
    return path.replace(/\\/g, "/");
  }
  return path;
}

/** Split a local path into segments (preserves leading `~` or `/`). */
export function splitLocalPath(path: string): string[] {
  if (path === "~") return ["~"];
  if (path.startsWith("~/")) {
    return ["~", ...path.slice(2).split("/").filter(Boolean)];
  }
  if (path === "/") return ["/"];

  const normalized = normalizeSeparators(path);
  if (isWindowsAbsolute(path)) {
    const driveMatch = /^([A-Za-z]:)(?:\/(.*))?$/.exec(normalized);
    if (!driveMatch) return [path];
    const drive = driveMatch[1] ?? "";
    const rest = driveMatch[2] ?? "";
    return [drive, ...rest.split("/").filter(Boolean)];
  }

  if (normalized.startsWith("/")) {
    return ["/", ...normalized.slice(1).split("/").filter(Boolean)];
  }

  return normalized.split("/").filter(Boolean);
}

/** Return the parent directory of a local path. */
export function parentLocalPath(path: string): string {
  if (path === "~" || path === "/") return path;

  if (path.startsWith("~/")) {
    const parent = path.replace(/\/[^/]+$/, "");
    return parent === "~" || parent === "" ? "~" : parent;
  }

  if (isWindowsAbsolute(path)) {
    const normalized = normalizeSeparators(path);
    const parent = normalized.replace(/\/[^/]+$/, "");
    if (/^[A-Za-z]:$/.test(parent)) return parent;
    if (parent === "") return path;
    return parent;
  }

  const parent = path.replace(/\/[^/]+$/, "");
  return parent === "" ? "/" : parent;
}

/** Join path segments using the platform-appropriate separator. */
export function joinLocalPath(...segments: string[]): string {
  if (segments.length === 0) return "";

  const first = segments[0] ?? "";
  const useBackslash = isWindowsAbsolute(first) || first.includes("\\");
  const sep = useBackslash ? "\\" : "/";

  let result = first;
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i] ?? "";
    if (!segment) continue;
    const trimmed = segment.replace(/^[/\\]+|[/\\]+$/g, "");
    if (!trimmed) continue;
    result = result.endsWith(sep) || result.endsWith("/") || result.endsWith("\\")
      ? `${result}${trimmed}`
      : `${result}${sep}${trimmed}`;
  }

  return result;
}

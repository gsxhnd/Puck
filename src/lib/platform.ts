export type Platform = "macos" | "windows" | "linux";

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export function getPlatform(): Platform {
  const envPlatform = import.meta.env.TAURI_ENV_PLATFORM as string | undefined;
  if (envPlatform === "macos" || envPlatform === "darwin") return "macos";
  if (envPlatform === "windows") return "windows";
  if (envPlatform === "linux") return "linux";

  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) return "macos";
    if (ua.includes("win")) return "windows";
  }

  return "linux";
}

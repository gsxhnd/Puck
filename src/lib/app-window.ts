export type AppWindowMode = "main" | "settings" | "connections";

export const SETTINGS_WINDOW_LABEL = "settings";
export const CONNECTIONS_WINDOW_LABEL = "connections";

export function getAppWindowMode(): AppWindowMode {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("window");
  if (mode === "settings") return "settings";
  if (mode === "connections") return "connections";
  return "main";
}

export function buildSettingsWindowUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("window", "settings");
  return url.toString();
}

export function buildConnectionsWindowUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("window", "connections");
  return url.toString();
}

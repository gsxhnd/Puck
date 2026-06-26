export type AppWindowMode = "main" | "settings";

export const SETTINGS_WINDOW_LABEL = "settings";

export function getAppWindowMode(): AppWindowMode {
  const params = new URLSearchParams(window.location.search);
  return params.get("window") === "settings" ? "settings" : "main";
}

export function buildSettingsWindowUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("window", "settings");
  return url.toString();
}

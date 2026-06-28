import type { ThemeMode } from "@/types/settings";

export function getEffectiveTheme(themeMode: ThemeMode): "light" | "dark" {
  if (themeMode === "dark") return "dark";
  if (themeMode === "light") return "light";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

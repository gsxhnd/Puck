import { invoke } from "@tauri-apps/api/core";
import { BUILTIN_COLOR_THEME_ID } from "@/lib/color-themes";
import { isRecord } from "@/lib/ipc-parse";
import { isTauri } from "@/lib/platform";

export type ColorThemeInfo = {
  id: string;
  source: "builtin" | "external";
};

const BUILTIN_THEME: ColorThemeInfo = {
  id: BUILTIN_COLOR_THEME_ID,
  source: "builtin",
};

function parseColorThemeInfo(value: unknown): ColorThemeInfo | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (value.source !== "builtin" && value.source !== "external") return null;
  return { id: value.id, source: value.source };
}

export async function listColorThemes(): Promise<ColorThemeInfo[]> {
  if (!isTauri()) {
    return [BUILTIN_THEME];
  }

  const result = await invoke<unknown>("list_color_themes_command");
  if (!Array.isArray(result)) return [BUILTIN_THEME];
  const themes = result
    .map((item) => parseColorThemeInfo(item))
    .filter((item): item is ColorThemeInfo => item !== null);
  return themes.length > 0 ? themes : [BUILTIN_THEME];
}

export async function readColorThemeCss(themeId: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("external color themes require the Tauri app");
  }

  const result = await invoke<unknown>("read_color_theme_css_command", {
    themeId,
  });
  if (typeof result !== "string") {
    throw new Error("Invalid color theme CSS response");
  }
  return result;
}

export async function getThemesDir(): Promise<string | null> {
  if (!isTauri()) return null;
  const result = await invoke<unknown>("get_themes_dir");
  return typeof result === "string" ? result : null;
}

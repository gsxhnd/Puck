import { invoke } from "@tauri-apps/api/core";
import { BUILTIN_COLOR_THEME_ID } from "@/lib/color-themes";
import { isTauri } from "@/lib/platform";

export type ColorThemeInfo = {
  id: string;
  source: "builtin" | "external";
};

const BUILTIN_THEME: ColorThemeInfo = {
  id: BUILTIN_COLOR_THEME_ID,
  source: "builtin",
};

export async function listColorThemes(): Promise<ColorThemeInfo[]> {
  if (!isTauri()) {
    return [BUILTIN_THEME];
  }

  return invoke<ColorThemeInfo[]>("list_color_themes_command");
}

export async function readColorThemeCss(themeId: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("external color themes require the Tauri app");
  }

  return invoke<string>("read_color_theme_css_command", { themeId });
}

export async function getThemesDir(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string>("get_themes_dir");
}

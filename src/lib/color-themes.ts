export const COLOR_THEME_IDS = [
  "default",
  "zinc",
  "slate",
  "stone",
  "rose",
  "blue",
  "green",
  "violet",
  "catppuccin",
  "nord",
] as const;

export type ColorThemeId = (typeof COLOR_THEME_IDS)[number];

export const DEFAULT_COLOR_THEME: ColorThemeId = "default";

export function isColorThemeId(value: string): value is ColorThemeId {
  return COLOR_THEME_IDS.includes(value as ColorThemeId);
}

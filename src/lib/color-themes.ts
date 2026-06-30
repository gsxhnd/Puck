/** Built-in default theme id (light/dark bundled in the frontend). */
export const BUILTIN_COLOR_THEME_ID = "default" as const;

export const DEFAULT_COLOR_THEME = BUILTIN_COLOR_THEME_ID;

/** Any theme id: built-in `default` or an external/custom theme file name. */
export type ColorThemeId = string;

const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidColorThemeId(value: string): boolean {
  return value.length > 0 && value.length <= 64 && THEME_ID_PATTERN.test(value);
}

/** @deprecated Use isValidColorThemeId — kept for migration call sites. */
export function isColorThemeId(value: string): value is ColorThemeId {
  return isValidColorThemeId(value);
}

export function isBuiltinColorTheme(themeId: string): boolean {
  return themeId === BUILTIN_COLOR_THEME_ID;
}

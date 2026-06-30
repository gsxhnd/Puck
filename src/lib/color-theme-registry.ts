import {
  BUILTIN_COLOR_THEME_ID,
  isBuiltinColorTheme,
  isValidColorThemeId,
  type ColorThemeId,
} from "@/lib/color-themes";
import {
  listColorThemes,
  readColorThemeCss,
  type ColorThemeInfo,
} from "@/lib/tauri-themes";

const STYLE_ELEMENT_ID_PREFIX = "puck-color-theme-";
const loadedThemeIds = new Set<string>([BUILTIN_COLOR_THEME_ID]);

let availableThemes: ColorThemeInfo[] = [];
let initPromise: Promise<ColorThemeInfo[]> | null = null;

function styleElementId(themeId: string): string {
  return `${STYLE_ELEMENT_ID_PREFIX}${themeId}`;
}

function injectThemeCss(themeId: string, css: string): void {
  if (typeof document === "undefined") return;

  let element = document.getElementById(styleElementId(themeId));
  if (!element) {
    element = document.createElement("style");
    element.id = styleElementId(themeId);
    document.head.appendChild(element);
  }
  element.textContent = css;
  loadedThemeIds.add(themeId);
}

/** Preload theme registry and seed external themes on disk (Tauri). */
export function initColorThemeRegistry(): Promise<ColorThemeInfo[]> {
  if (!initPromise) {
    initPromise = listColorThemes().then((themes) => {
      availableThemes = themes;
      return themes;
    });
  }
  return initPromise;
}

export function getAvailableColorThemes(): ColorThemeInfo[] {
  return availableThemes;
}

export function isKnownColorTheme(themeId: string): boolean {
  return availableThemes.some((theme) => theme.id === themeId);
}

export async function ensureColorThemeStylesLoaded(
  themeId: ColorThemeId,
): Promise<ColorThemeId> {
  if (!isValidColorThemeId(themeId) || isBuiltinColorTheme(themeId)) {
    return BUILTIN_COLOR_THEME_ID;
  }
  if (loadedThemeIds.has(themeId)) return themeId;

  try {
    const css = await readColorThemeCss(themeId);
    injectThemeCss(themeId, css);
    return themeId;
  } catch {
    return BUILTIN_COLOR_THEME_ID;
  }
}

export async function refreshColorThemeRegistry(): Promise<ColorThemeInfo[]> {
  initPromise = null;
  return initColorThemeRegistry();
}

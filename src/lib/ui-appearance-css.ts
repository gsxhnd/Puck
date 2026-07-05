import {
  DEFAULT_UI_APPEARANCE,
  SHELL_LAYERING_MIX,
  UI_BORDER_RADIUS_PRESETS,
  UI_SHELL_LAYERING_PRESETS,
  UI_WINDOW_RADIUS_PRESETS,
  type UiAppearance,
  type UiBorderRadiusPreset,
  type UiShellLayeringPreset,
  type UiWindowRadiusPreset,
} from "@/types/ui-appearance";

export const UI_APPEARANCE_CSS_VARS = [
  "--ui-font-family",
  "--ui-radius",
  "--ui-window-radius",
  "--shell-primary-mix",
  "--shell-secondary-mix",
  "--terminal-padding-x",
  "--terminal-padding-y",
] as const;

export type UiAppearanceOverrides = Partial<UiAppearance>;

export const UI_APPEARANCE_KEYS = [
  "uiFontFamily",
  "borderRadius",
  "windowRadius",
  "shellLayering",
  "terminalPaddingX",
  "terminalPaddingY",
] as const satisfies ReadonlyArray<keyof UiAppearance>;

/** Maps appearance fields to CSS custom properties for inline overrides. */
export function uiAppearanceToCssProperties(
  appearance: UiAppearanceOverrides,
): Record<string, string> {
  const props: Record<string, string> = {};

  if (appearance.uiFontFamily) {
    props["--ui-font-family"] = appearance.uiFontFamily;
  }
  if (appearance.borderRadius) {
    props["--ui-radius"] = `${appearance.borderRadius}rem`;
  }
  if (appearance.windowRadius !== undefined) {
    props["--ui-window-radius"] = `${appearance.windowRadius}px`;
  }
  if (appearance.shellLayering) {
    const shellMix = SHELL_LAYERING_MIX[appearance.shellLayering];
    props["--shell-primary-mix"] = `${shellMix.primary}%`;
    props["--shell-secondary-mix"] = `${shellMix.secondary}%`;
  }
  if (appearance.terminalPaddingX !== undefined) {
    props["--terminal-padding-x"] = `${appearance.terminalPaddingX}px`;
  }
  if (appearance.terminalPaddingY !== undefined) {
    props["--terminal-padding-y"] = `${appearance.terminalPaddingY}px`;
  }

  return props;
}

function parseBorderRadiusPreset(value: string): UiBorderRadiusPreset | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const rem = trimmed.endsWith("rem")
    ? trimmed.slice(0, -3)
    : trimmed.replace(/px$/, "");

  return UI_BORDER_RADIUS_PRESETS.find((preset) => preset === rem);
}

function parseWindowRadiusPreset(value: string): UiWindowRadiusPreset | undefined {
  const parsed = Number.parseInt(value.trim(), 10);
  if (Number.isNaN(parsed)) return undefined;
  return UI_WINDOW_RADIUS_PRESETS.includes(parsed as UiWindowRadiusPreset)
    ? (parsed as UiWindowRadiusPreset)
    : undefined;
}

function parseShellLayering(
  primaryValue: string,
  secondaryValue: string,
): UiShellLayeringPreset | undefined {
  const primary = Number.parseInt(primaryValue, 10);
  const secondary = Number.parseInt(secondaryValue, 10);
  if (Number.isNaN(primary) || Number.isNaN(secondary)) return undefined;

  for (const preset of UI_SHELL_LAYERING_PRESETS) {
    const mix = SHELL_LAYERING_MIX[preset];
    if (mix.primary === primary && mix.secondary === secondary) {
      return preset;
    }
  }

  return undefined;
}

function parseTerminalPadding(value: string): number | undefined {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Reads the active color theme's resolved UI chrome from computed CSS variables. */
export function readUiAppearanceFromDom(): UiAppearance {
  if (typeof document === "undefined") {
    return { ...DEFAULT_UI_APPEARANCE };
  }

  const styles = getComputedStyle(document.documentElement);

  return {
    uiFontFamily:
      styles.getPropertyValue("--ui-font-family").trim() ||
      DEFAULT_UI_APPEARANCE.uiFontFamily,
    borderRadius:
      parseBorderRadiusPreset(styles.getPropertyValue("--ui-radius")) ??
      DEFAULT_UI_APPEARANCE.borderRadius,
    windowRadius:
      parseWindowRadiusPreset(styles.getPropertyValue("--ui-window-radius")) ??
      DEFAULT_UI_APPEARANCE.windowRadius,
    shellLayering:
      parseShellLayering(
        styles.getPropertyValue("--shell-primary-mix"),
        styles.getPropertyValue("--shell-secondary-mix"),
      ) ?? DEFAULT_UI_APPEARANCE.shellLayering,
    terminalPaddingX:
      parseTerminalPadding(styles.getPropertyValue("--terminal-padding-x")) ??
      DEFAULT_UI_APPEARANCE.terminalPaddingX,
    terminalPaddingY:
      parseTerminalPadding(styles.getPropertyValue("--terminal-padding-y")) ??
      DEFAULT_UI_APPEARANCE.terminalPaddingY,
  };
}

/** Merges theme-resolved values with user overrides (overrides win). */
export function resolveUiAppearance(
  overrides: UiAppearanceOverrides,
  themeAppearance: UiAppearance = readUiAppearanceFromDom(),
): UiAppearance {
  return {
    ...themeAppearance,
    ...overrides,
  };
}

/** Extracts persisted overrides from a legacy full appearance object. */
export function uiAppearanceToOverrides(
  appearance?: Partial<UiAppearance>,
): UiAppearanceOverrides {
  if (!appearance) return {};

  const overrides: UiAppearanceOverrides = {};
  for (const key of UI_APPEARANCE_KEYS) {
    const value = appearance[key];
    if (value === undefined) continue;
    if (value === DEFAULT_UI_APPEARANCE[key]) continue;
    (overrides as Record<typeof key, UiAppearance[typeof key]>)[key] = value;
  }
  return overrides;
}

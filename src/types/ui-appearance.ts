/**
 * User-customizable UI chrome tokens (radius, fonts, shell layering, terminal inset).
 *
 * 用户可调的界面外观令牌：圆角、界面字体、壳层背景混合比例与终端内边距等，
 * 通过 CSS 变量应用到全局 UI，与配色主题（color theme）相互独立。
 */

export const UI_BORDER_RADIUS_PRESETS = [
  "0.375",
  "0.5",
  "0.625",
  "0.75",
  "1",
] as const;

export type UiBorderRadiusPreset = (typeof UI_BORDER_RADIUS_PRESETS)[number];

export const UI_WINDOW_RADIUS_PRESETS = [0, 6, 10, 14, 18] as const;

export type UiWindowRadiusPreset = (typeof UI_WINDOW_RADIUS_PRESETS)[number];

export const UI_SHELL_LAYERING_PRESETS = ["subtle", "default", "pronounced"] as const;

export type UiShellLayeringPreset = (typeof UI_SHELL_LAYERING_PRESETS)[number];

export const SHELL_LAYERING_MIX: Record<
  UiShellLayeringPreset,
  { primary: number; secondary: number }
> = {
  subtle: { primary: 98, secondary: 94 },
  default: { primary: 96, secondary: 92 },
  pronounced: { primary: 92, secondary: 88 },
};

export type UiAppearance = {
  uiFontFamily: string;
  borderRadius: UiBorderRadiusPreset;
  windowRadius: UiWindowRadiusPreset;
  shellLayering: UiShellLayeringPreset;
  terminalPaddingX: number;
  terminalPaddingY: number;
};

export type UiAppearanceOverrides = Partial<UiAppearance>;

export const DEFAULT_UI_FONT_FAMILY = '"Inter Variable", sans-serif';

export const DEFAULT_UI_APPEARANCE: UiAppearance = {
  uiFontFamily: DEFAULT_UI_FONT_FAMILY,
  borderRadius: "0.625",
  windowRadius: 10,
  shellLayering: "default",
  terminalPaddingX: 10,
  terminalPaddingY: 8,
};

export function normalizeUiAppearance(
  appearance?: Partial<UiAppearance>,
): UiAppearance {
  const borderRadius = UI_BORDER_RADIUS_PRESETS.includes(
    appearance?.borderRadius as UiBorderRadiusPreset,
  )
    ? (appearance!.borderRadius as UiBorderRadiusPreset)
    : DEFAULT_UI_APPEARANCE.borderRadius;

  const windowRadius = UI_WINDOW_RADIUS_PRESETS.includes(
    appearance?.windowRadius as UiWindowRadiusPreset,
  )
    ? (appearance!.windowRadius as UiWindowRadiusPreset)
    : DEFAULT_UI_APPEARANCE.windowRadius;

  const shellLayering = UI_SHELL_LAYERING_PRESETS.includes(
    appearance?.shellLayering as UiShellLayeringPreset,
  )
    ? (appearance!.shellLayering as UiShellLayeringPreset)
    : DEFAULT_UI_APPEARANCE.shellLayering;

  const terminalPaddingX = clampTerminalPadding(
    appearance?.terminalPaddingX,
    DEFAULT_UI_APPEARANCE.terminalPaddingX,
  );
  const terminalPaddingY = clampTerminalPadding(
    appearance?.terminalPaddingY,
    DEFAULT_UI_APPEARANCE.terminalPaddingY,
  );

  const uiFontFamily =
    appearance?.uiFontFamily?.trim() || DEFAULT_UI_APPEARANCE.uiFontFamily;

  return {
    uiFontFamily,
    borderRadius,
    windowRadius,
    shellLayering,
    terminalPaddingX,
    terminalPaddingY,
  };
}

function clampTerminalPadding(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(24, Math.max(0, Math.round(value)));
}

/** Validates user override fields without filling theme defaults. */
export function normalizeUiAppearanceOverrides(
  overrides: UiAppearanceOverrides,
): UiAppearanceOverrides {
  const normalized: UiAppearanceOverrides = {};

  if (overrides.uiFontFamily?.trim()) {
    normalized.uiFontFamily = overrides.uiFontFamily.trim();
  }

  if (
    overrides.borderRadius &&
    UI_BORDER_RADIUS_PRESETS.includes(overrides.borderRadius)
  ) {
    normalized.borderRadius = overrides.borderRadius;
  }

  if (
    overrides.windowRadius !== undefined &&
    UI_WINDOW_RADIUS_PRESETS.includes(overrides.windowRadius)
  ) {
    normalized.windowRadius = overrides.windowRadius;
  }

  if (
    overrides.shellLayering &&
    UI_SHELL_LAYERING_PRESETS.includes(overrides.shellLayering)
  ) {
    normalized.shellLayering = overrides.shellLayering;
  }

  if (overrides.terminalPaddingX !== undefined) {
    normalized.terminalPaddingX = clampTerminalPadding(
      overrides.terminalPaddingX,
      DEFAULT_UI_APPEARANCE.terminalPaddingX,
    );
  }

  if (overrides.terminalPaddingY !== undefined) {
    normalized.terminalPaddingY = clampTerminalPadding(
      overrides.terminalPaddingY,
      DEFAULT_UI_APPEARANCE.terminalPaddingY,
    );
  }

  return normalized;
}

import type { ITheme } from "@xterm/xterm";

const puckDark: ITheme = {
  background: "#1e1e2e",
  foreground: "#cdd6f4",
  cursor: "#f5e0dc",
  cursorAccent: "#1e1e2e",
  selectionBackground: "#45475a",
  selectionForeground: "#cdd6f4",
  black: "#45475a",
  red: "#f38ba8",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  blue: "#89b4fa",
  magenta: "#f5c2e7",
  cyan: "#94e2d5",
  white: "#bac2de",
  brightBlack: "#585b70",
  brightRed: "#f38ba8",
  brightGreen: "#a6e3a1",
  brightYellow: "#f9e2af",
  brightBlue: "#89b4fa",
  brightMagenta: "#f5c2e7",
  brightCyan: "#94e2d5",
  brightWhite: "#a6adc8",
};

const puckLight: ITheme = {
  background: "#eff1f5",
  foreground: "#4c4f69",
  cursor: "#dc8a78",
  cursorAccent: "#eff1f5",
  selectionBackground: "#ccd0da",
  selectionForeground: "#4c4f69",
  black: "#5c5f77",
  red: "#d20f39",
  green: "#40a02b",
  yellow: "#df8e1d",
  blue: "#1e66f5",
  magenta: "#ea76cb",
  cyan: "#179299",
  white: "#acb0be",
  brightBlack: "#6c6f85",
  brightRed: "#d20f39",
  brightGreen: "#40a02b",
  brightYellow: "#df8e1d",
  brightBlue: "#1e66f5",
  brightMagenta: "#ea76cb",
  brightCyan: "#179299",
  brightWhite: "#bcc0cc",
};

function isValidComputedColor(color: string | undefined): color is string {
  if (!color) return false;
  const normalized = color.trim().toLowerCase();
  return (
    normalized !== "transparent" &&
    normalized !== "rgba(0, 0, 0, 0)" &&
    normalized !== "initial"
  );
}

function readCssVariableColor(
  variable: string,
  property: "backgroundColor" | "color",
  fallback: string,
): string {
  if (typeof document === "undefined") {
    return fallback;
  }

  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  probe.style.width = "1px";
  probe.style.height = "1px";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  if (property === "backgroundColor") {
    probe.style.backgroundColor = `var(${variable})`;
  } else {
    probe.style.color = `var(${variable})`;
  }

  document.documentElement.appendChild(probe);
  const color = getComputedStyle(probe)[property];
  probe.remove();

  return isValidComputedColor(color) ? color : fallback;
}

function isDarkColor(color: string): boolean {
  const match = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (!match) {
    return color.startsWith("#")
      ? Number.parseInt(color.slice(1, 3), 16) < 128
      : true;
  }

  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

export function getUiSyncedTerminalTheme(): ITheme {
  const background = readCssVariableColor(
    "--background",
    "backgroundColor",
    puckDark.background ?? "#000000",
  );
  const foreground = readCssVariableColor(
    "--foreground",
    "color",
    puckDark.foreground ?? "#ffffff",
  );
  const selectionBackground = readCssVariableColor(
    "--muted",
    "backgroundColor",
    background,
  );
  const ansiBase = isDarkColor(background) ? puckDark : puckLight;

  return {
    ...ansiBase,
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground,
    selectionForeground: foreground,
  };
}

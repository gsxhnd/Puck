import type { FitAddon } from "@xterm/addon-fit";
import type { ITheme, Terminal } from "@xterm/xterm";

type ApplyTerminalThemeOptions = {
  terminal: Terminal;
  theme: ITheme;
};

type ApplyTerminalFontOptions = {
  terminal: Terminal;
  fitAddon?: FitAddon | null;
  fontFamily: string;
  fontSize: number;
  onResize?: (cols: number, rows: number) => void;
};

/** Updates terminal colors only. Avoid refresh/fit to prevent WKWebView crashes. */
export function applyTerminalTheme({
  terminal,
  theme,
}: ApplyTerminalThemeOptions): void {
  terminal.options.theme = { ...theme };
}

/** Updates font metrics and reflows the active terminal. */
export function applyTerminalFont({
  terminal,
  fitAddon,
  fontFamily,
  fontSize,
  onResize,
}: ApplyTerminalFontOptions): void {
  terminal.options.fontFamily = fontFamily;
  terminal.options.fontSize = fontSize;

  if (!fitAddon || terminal.rows <= 0) return;

  requestAnimationFrame(() => {
    fitAddon.fit();
    onResize?.(terminal.cols, terminal.rows);
  });
}

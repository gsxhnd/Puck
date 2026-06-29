import type { ITerminalOptions, ITheme } from "@xterm/xterm";
import type { AppSettings } from "@/types/settings";

export function buildTerminalOptions(
  settings: Pick<
    AppSettings,
    "fontFamily" | "fontSize" | "cursorBlink" | "scrollback" | "copyOnSelect"
  >,
  theme: ITheme,
): ITerminalOptions {
  return {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    theme,
    cursorBlink: settings.cursorBlink,
    allowProposedApi: true,
    scrollback: settings.scrollback,
  };
}

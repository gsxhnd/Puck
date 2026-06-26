import type { ColorThemeId } from "@/lib/color-themes";
import { DEFAULT_COLOR_THEME } from "@/lib/color-themes";

export type ThemeMode = "light" | "dark" | "system";

export type AppLanguage = "zh-CN" | "en-US";

export type AppSettings = {
  language: AppLanguage;
  colorTheme: ColorThemeId;
  themeMode: ThemeMode;
  fontFamily: string;
  fontSize: number;
  openLocalTerminalOnStart: boolean;
};

export const DEFAULT_TERMINAL_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: "zh-CN",
  colorTheme: DEFAULT_COLOR_THEME,
  themeMode: "system",
  fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
  fontSize: 14,
  openLocalTerminalOnStart: true,
};

export type UiTheme = "light" | "dark" | "system";

export type AppLanguage = "zh-CN" | "en-US";

export type TerminalThemeId =
  | "puck-dark"
  | "puck-light"
  | "solarized-dark"
  | "solarized-light"
  | "one-dark";

export type AppSettings = {
  language: AppLanguage;
  uiTheme: UiTheme;
  terminalThemeId: TerminalThemeId;
  fontFamily: string;
  fontSize: number;
  openLocalTerminalOnStart: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: "zh-CN",
  uiTheme: "system",
  terminalThemeId: "puck-dark",
  fontFamily: "Inter Variable, monospace",
  fontSize: 14,
  openLocalTerminalOnStart: true,
};

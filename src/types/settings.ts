/**
 * Application settings shape and default values.
 *
 * 应用全局设置的类型定义与默认值：语言、主题、终端外观、启动行为以及默认
 * 会话权限等字段，供 app-settings-store 使用。
 */
import type { ColorThemeId } from "@/lib/color-themes";
import { DEFAULT_COLOR_THEME } from "@/lib/color-themes";
import {
  DEFAULT_SESSION_PRIVILEGES,
  type SessionPrivileges,
} from "@/types/session-privileges";
import {
  type UiAppearanceOverrides,
} from "@/types/ui-appearance";

export type ThemeMode = "light" | "dark" | "system";

export type AppLanguage = "zh-CN" | "en-US";

export type AppSettings = {
  language: AppLanguage;
  colorTheme: ColorThemeId;
  themeMode: ThemeMode;
  uiAppearanceOverrides: UiAppearanceOverrides;
  fontFamily: string;
  fontSize: number;
  cursorBlink: boolean;
  scrollback: number;
  copyOnSelect: boolean;
  openLocalTerminalOnStart: boolean;
  defaultSessionPrivileges: SessionPrivileges;
};

export const DEFAULT_TERMINAL_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: "zh-CN",
  colorTheme: DEFAULT_COLOR_THEME,
  themeMode: "dark",
  uiAppearanceOverrides: {},
  fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
  fontSize: 14,
  cursorBlink: true,
  scrollback: 5000,
  copyOnSelect: false,
  openLocalTerminalOnStart: true,
  defaultSessionPrivileges: { ...DEFAULT_SESSION_PRIVILEGES },
};

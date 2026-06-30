/**
 * Application settings shape and default values.
 *
 * 应用全局设置的类型定义与默认值：语言、主题、终端外观、面板可见性以及
 * 默认会话权限等字段，供 app-settings-store 使用。
 */
import type { ColorThemeId } from "@/lib/color-themes";
import { DEFAULT_COLOR_THEME } from "@/lib/color-themes";
import {
  DEFAULT_SESSION_PRIVILEGES,
  type SessionPrivileges,
} from "@/types/session-privileges";

export type ThemeMode = "light" | "dark" | "system";

export type AppLanguage = "zh-CN" | "en-US";

export type SystemResourceMetricKey =
  | "cpu"
  | "memory"
  | "disk"
  | "loadAverage"
  | "swap";

export type SystemResourceMetrics = Record<SystemResourceMetricKey, boolean>;

export const SYSTEM_RESOURCE_POLL_INTERVALS_MS = [
  1000, 2000, 3000, 5000, 10000,
] as const;

export type SystemResourcePollIntervalMs =
  (typeof SYSTEM_RESOURCE_POLL_INTERVALS_MS)[number];

export const DEFAULT_SYSTEM_RESOURCE_METRICS: SystemResourceMetrics = {
  cpu: true,
  memory: true,
  disk: true,
  loadAverage: true,
  swap: true,
};

export type AppSettings = {
  language: AppLanguage;
  colorTheme: ColorThemeId;
  themeMode: ThemeMode;
  fontFamily: string;
  fontSize: number;
  cursorBlink: boolean;
  scrollback: number;
  copyOnSelect: boolean;
  openLocalTerminalOnStart: boolean;
  primaryPanelOpen: boolean;
  secondPanelOpen: boolean;
  defaultSessionPrivileges: SessionPrivileges;
  systemResourcesLocalPollIntervalMs: SystemResourcePollIntervalMs;
  systemResourcesRemotePollIntervalMs: SystemResourcePollIntervalMs;
  systemResourcesMetrics: SystemResourceMetrics;
};

export const DEFAULT_TERMINAL_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: "zh-CN",
  colorTheme: DEFAULT_COLOR_THEME,
  themeMode: "dark",
  fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
  fontSize: 14,
  cursorBlink: true,
  scrollback: 5000,
  copyOnSelect: false,
  openLocalTerminalOnStart: true,
  primaryPanelOpen: true,
  secondPanelOpen: true,
  defaultSessionPrivileges: { ...DEFAULT_SESSION_PRIVILEGES },
  systemResourcesLocalPollIntervalMs: 2000,
  systemResourcesRemotePollIntervalMs: 3000,
  systemResourcesMetrics: { ...DEFAULT_SYSTEM_RESOURCE_METRICS },
};

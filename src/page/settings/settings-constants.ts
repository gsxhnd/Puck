import { COLOR_THEME_IDS } from "@/lib/color-themes";
import type { AppLanguage, ThemeMode } from "@/types/settings";
import type { SessionPrivilegeKey } from "@/types/session-privileges";
import type { LucideIcon } from "lucide-react";
import {
  InfoIcon,
  KeyboardIcon,
  NetworkIcon,
  PaletteIcon,
  Settings2Icon,
  TerminalIcon,
} from "lucide-react";

/**
 * Settings navigation section identifiers.
 *
 * 设置页左侧导航的区段标识符，与 i18n 键 `settings:sections.*` 一一对应。
 */
export type SettingsSection =
  | "general"
  | "appearance"
  | "terminal"
  | "connections"
  | "keyboard"
  | "about";

/** Ordered list of settings sections shown in the sidebar. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  "general",
  "appearance",
  "terminal",
  "connections",
  "keyboard",
  "about",
];

/** Sidebar icon for each settings section. */
export const SETTINGS_SECTION_ICONS: Record<SettingsSection, LucideIcon> = {
  general: Settings2Icon,
  appearance: PaletteIcon,
  terminal: TerminalIcon,
  connections: NetworkIcon,
  keyboard: KeyboardIcon,
  about: InfoIcon,
};

export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];
export const LANGUAGES: AppLanguage[] = ["zh-CN", "en-US"];
export { COLOR_THEME_IDS };

/** Default session privilege toggles shown under Terminal settings. */
export const DEFAULT_PRIVILEGE_ITEMS: Array<{
  key: SessionPrivilegeKey;
  labelKey: string;
  descriptionKey?: string;
}> = [
  {
    key: "allowTerminalBell",
    labelKey: "settings:terminal.privileges.allowTerminalBell",
  },
  {
    key: "notifyOnErrorExit",
    labelKey: "settings:terminal.privileges.notifyOnErrorExit",
  },
  {
    key: "notifyOnCommandFinish",
    labelKey: "settings:terminal.privileges.notifyOnCommandFinish",
  },
  {
    key: "tabBadgeWhenCommandFinishes",
    labelKey: "settings:terminal.privileges.tabBadgeWhenCommandFinishes",
  },
  {
    key: "keepAwakeWhenTaskRunning",
    labelKey: "settings:terminal.privileges.keepAwakeWhenTaskRunning",
  },
];

/** Read-only keyboard shortcut reference for the Keyboard settings section. */
export const KEYBOARD_SHORTCUTS: Array<{ labelKey: string; shortcut: string }> =
  [
    { labelKey: "settings:keyboard.newTerminal", shortcut: "⌘T" },
    { labelKey: "settings:keyboard.closeTab", shortcut: "⌘W" },
    { labelKey: "settings:keyboard.commandPalette", shortcut: "⌘K" },
    { labelKey: "settings:keyboard.openSettings", shortcut: "⌘," },
    { labelKey: "settings:keyboard.togglePrimaryPanel", shortcut: "⇧⌘L" },
    { labelKey: "settings:keyboard.toggleSecondPanel", shortcut: "⇧⌘R" },
    { labelKey: "settings:keyboard.search", shortcut: "⌘F" },
    { labelKey: "settings:keyboard.searchAllTabs", shortcut: "⇧⌘F" },
    { labelKey: "settings:keyboard.jumpToOutline", shortcut: "⌘J" },
    { labelKey: "settings:keyboard.splitRight", shortcut: "⌘D" },
    { labelKey: "settings:keyboard.splitLeft", shortcut: "⌥⌘D" },
    { labelKey: "settings:keyboard.splitDown", shortcut: "⇧⌘D" },
    { labelKey: "settings:keyboard.splitUp", shortcut: "⌥⇧⌘D" },
  ];

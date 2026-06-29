import type { OpenInAppId } from "@/lib/open-in-app";

/** Top-level palette pages; "open-in" is a nested app picker. */
export type PalettePage = "root" | "open-in";

/** Command grouping keys used for section headers. */
export type CommandSection = "workingDirectory" | "view" | "openIn";

/** A single executable entry in the command palette. */
export type PaletteCommand = {
  id: string;
  section: CommandSection;
  label: string;
  shortcut?: string;
  checked?: boolean;
  hasSubmenu?: boolean;
  keywords?: string[];
  disabled?: boolean;
  run: () => void | Promise<void>;
};

/** External apps listed under the "Open In" submenu. */
export const OPEN_IN_APPS: Array<{ id: OpenInAppId; labelKey: string }> = [
  { id: "vscode", labelKey: "terminal:titleMenu.apps.vscode" },
  { id: "cursor", labelKey: "terminal:titleMenu.apps.cursor" },
  { id: "xcode", labelKey: "terminal:titleMenu.apps.xcode" },
  { id: "zed", labelKey: "terminal:titleMenu.apps.zed" },
  { id: "finder", labelKey: "terminal:titleMenu.apps.finder" },
  { id: "terminal", labelKey: "terminal:titleMenu.apps.terminal" },
];

/** Case-insensitive match against label and optional keywords. */
export function matchesPaletteQuery(command: PaletteCommand, query: string): boolean {
  if (!query.trim()) {
    return true;
  }

  const haystack = [command.label, ...(command.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

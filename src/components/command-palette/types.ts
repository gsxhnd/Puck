import type { OpenInAppId } from "@/lib/open-in-app";

/** Top-level palette pages; "open-in" is a nested app picker. */
export type PalettePage = "root" | "open-in" | "new-terminal";

/** Command grouping keys used for section headers. */
export type CommandSection =
  | "workingDirectory"
  | "view"
  | "openIn"
  | "connections"
  | "terminal"
  | "actions";

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

const CONNECT_PREFIXES = ["connect", "连接"] as const;

function parseSingleConnectPrefix(
  query: string,
  prefix: (typeof CONNECT_PREFIXES)[number],
): { active: boolean; filter: string } {
  const trimmed = query.trimStart();
  const lower = trimmed.toLowerCase();
  const prefixLower = prefix.toLowerCase();

  if (trimmed === prefix || lower === prefixLower) {
    return { active: true, filter: "" };
  }

  if (lower.startsWith(`${prefixLower} `)) {
    return {
      active: true,
      filter: trimmed.slice(prefix.length + 1).trim(),
    };
  }

  if (lower.startsWith(`${prefixLower}:`)) {
    return {
      active: true,
      filter: trimmed.slice(prefix.length + 1).trim(),
    };
  }

  if (prefixLower === "connect" && lower.startsWith("connect") && lower.length >= 7) {
    const rest = trimmed.slice("connect".length).trimStart();
    const filter = rest.startsWith(":") ? rest.slice(1).trimStart() : rest;
    return { active: true, filter };
  }

  return { active: false, filter: "" };
}

/** When the query starts with `connect` / `连接`, list saved remote hosts. */
export function parseConnectPrefix(query: string): {
  active: boolean;
  filter: string;
} {
  for (const prefix of CONNECT_PREFIXES) {
    const parsed = parseSingleConnectPrefix(query, prefix);
    if (parsed.active) {
      return parsed;
    }
  }
  return { active: false, filter: "" };
}

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

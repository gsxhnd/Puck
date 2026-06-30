import type { LucideIcon } from "lucide-react";
import type { OpenInAppId } from "@/lib/open-in-app";

/** Prefix scopes that group palette commands. */
export type PalettePrefixId = "connect" | "view" | "cwd" | "open" | "action";

/** Command grouping keys used for section headers. */
export type CommandSection =
  | "recent"
  | "scopes"
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
  icon?: LucideIcon;
  shortcut?: string;
  checked?: boolean;
  keywords?: string[];
  disabled?: boolean;
  /** When set, selecting this item activates the prefix instead of running `run`. */
  prefixTarget?: PalettePrefixId;
  run: () => void | Promise<void>;
};

export type PalettePrefix = {
  id: PalettePrefixId;
  aliases: string[];
  labelKey: string;
  placeholderKey: string;
};

export const PALETTE_PREFIXES: PalettePrefix[] = [
  {
    id: "connect",
    aliases: ["connect", "连接"],
    labelKey: "commandPalette:scopes.connect",
    placeholderKey: "commandPalette:placeholders.connect",
  },
  {
    id: "view",
    aliases: ["view", "视图"],
    labelKey: "commandPalette:scopes.view",
    placeholderKey: "commandPalette:placeholders.view",
  },
  {
    id: "cwd",
    aliases: ["cwd", "dir", "目录"],
    labelKey: "commandPalette:scopes.cwd",
    placeholderKey: "commandPalette:placeholders.cwd",
  },
  {
    id: "open",
    aliases: ["open", "打开"],
    labelKey: "commandPalette:scopes.open",
    placeholderKey: "commandPalette:placeholders.open",
  },
  {
    id: "action",
    aliases: ["action", "actions", "操作"],
    labelKey: "commandPalette:scopes.action",
    placeholderKey: "commandPalette:placeholders.action",
  },
];

const PREFIX_BY_ID = new Map(PALETTE_PREFIXES.map((prefix) => [prefix.id, prefix]));

/** External apps listed under the `open` prefix. */
export const OPEN_IN_APPS: Array<{ id: OpenInAppId; labelKey: string }> = [
  { id: "vscode", labelKey: "terminal:titleMenu.apps.vscode" },
  { id: "cursor", labelKey: "terminal:titleMenu.apps.cursor" },
  { id: "xcode", labelKey: "terminal:titleMenu.apps.xcode" },
  { id: "zed", labelKey: "terminal:titleMenu.apps.zed" },
  { id: "finder", labelKey: "terminal:titleMenu.apps.finder" },
  { id: "terminal", labelKey: "terminal:titleMenu.apps.terminal" },
];

function parseSinglePrefix(
  query: string,
  prefix: PalettePrefix,
): { active: boolean; filter: string } {
  const trimmed = query.trimStart();
  const lower = trimmed.toLowerCase();

  for (const alias of prefix.aliases) {
    const aliasLower = alias.toLowerCase();

    if (trimmed === alias || lower === aliasLower) {
      return { active: true, filter: "" };
    }

    if (lower.startsWith(`${aliasLower} `)) {
      return {
        active: true,
        filter: trimmed.slice(alias.length + 1).trim(),
      };
    }

    if (lower.startsWith(`${aliasLower}:`)) {
      return {
        active: true,
        filter: trimmed.slice(alias.length + 1).trim(),
      };
    }
  }

  return { active: false, filter: "" };
}

/** When the query starts with a known prefix, return the active scope and filter text. */
export function parsePalettePrefix(query: string): {
  active: boolean;
  prefix: PalettePrefixId | null;
  filter: string;
} {
  for (const prefix of PALETTE_PREFIXES) {
    const parsed = parseSinglePrefix(query, prefix);
    if (parsed.active) {
      return { active: true, prefix: prefix.id, filter: parsed.filter };
    }
  }

  return { active: false, prefix: null, filter: "" };
}

export function getPalettePrefix(id: PalettePrefixId): PalettePrefix {
  return PREFIX_BY_ID.get(id)!;
}

export function prefixQuery(id: PalettePrefixId): string {
  const prefix = getPalettePrefix(id);
  return `${prefix.aliases[0]} `;
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

import type { ISearchOptions } from "@xterm/addon-search";
import type { SearchAddon } from "@xterm/addon-search";
import type { Terminal } from "@xterm/xterm";
import type { TerminalSearchOptions } from "@/stores/terminal-search-store";

type TerminalEntry = {
  terminal: Terminal;
  searchAddon: SearchAddon;
};

const terminals = new Map<string, TerminalEntry>();

const SEARCH_DECORATIONS: NonNullable<ISearchOptions["decorations"]> = {
  matchBackground: "#515c6a",
  activeMatchBackground: "#3b82f6",
  matchOverviewRuler: "#515c6a",
  activeMatchColorOverviewRuler: "#3b82f6",
};

export function registerTerminal(
  sessionId: string,
  terminal: Terminal,
  searchAddon: SearchAddon,
) {
  terminals.set(sessionId, { terminal, searchAddon });
}

export function unregisterTerminal(sessionId: string) {
  terminals.delete(sessionId);
}

export function getTerminalEntry(sessionId: string): TerminalEntry | undefined {
  return terminals.get(sessionId);
}

export function getAllTerminalSessionIds(): string[] {
  return [...terminals.keys()];
}

export function scrollTerminalToLine(sessionId: string, line: number): boolean {
  const entry = terminals.get(sessionId);
  if (!entry) {
    return false;
  }

  entry.terminal.scrollToLine(Math.max(0, line));
  entry.terminal.focus();
  return true;
}

export function focusTerminal(sessionId: string): boolean {
  const entry = terminals.get(sessionId);
  if (!entry) {
    return false;
  }

  entry.terminal.focus();
  return true;
}

function toSearchOptions(
  options: TerminalSearchOptions,
  incremental = false,
): ISearchOptions {
  return {
    caseSensitive: options.caseSensitive,
    wholeWord: options.wholeWord,
    regex: options.regex,
    incremental,
    decorations: SEARCH_DECORATIONS,
  };
}

function isWithinSelection(
  terminal: Terminal,
  row: number,
  col: number,
): boolean {
  const range = terminal.getSelectionPosition();
  if (!range) {
    return false;
  }

  const startRow = range.start.y;
  const endRow = range.end.y;
  const startCol = range.start.x;
  const endCol = range.end.x;

  if (row < startRow || row > endRow) {
    return false;
  }
  if (row === startRow && col < startCol) {
    return false;
  }
  if (row === endRow && col > endCol) {
    return false;
  }
  return true;
}

function findInSelectionOnly(
  entry: TerminalEntry,
  query: string,
  options: TerminalSearchOptions,
  previous: boolean,
): boolean {
  if (!entry.terminal.hasSelection()) {
    return false;
  }

  const searchOptions = toSearchOptions(options);
  const finder = previous
    ? entry.searchAddon.findPrevious.bind(entry.searchAddon)
    : entry.searchAddon.findNext.bind(entry.searchAddon);

  for (let attempt = 0; attempt < 512; attempt += 1) {
    const before = entry.terminal.getSelectionPosition();
    const found = finder(query, searchOptions);
    if (!found) {
      return false;
    }

    const after = entry.terminal.getSelectionPosition();
    if (
      after &&
      isWithinSelection(entry.terminal, after.start.y, after.start.x)
    ) {
      entry.terminal.focus();
      return true;
    }

    if (
      before &&
      after &&
      before.start.x === after.start.x &&
      before.start.y === after.start.y
    ) {
      return false;
    }
  }

  return false;
}

export function findInTerminal(
  sessionId: string,
  query: string,
  options: TerminalSearchOptions,
  direction?: { previous?: boolean; incremental?: boolean },
): boolean {
  const entry = terminals.get(sessionId);
  if (!entry || !query.trim()) {
    return false;
  }

  if (options.inSelectionOnly) {
    return findInSelectionOnly(
      entry,
      query,
      options,
      direction?.previous ?? false,
    );
  }

  const searchOptions = toSearchOptions(options, direction?.incremental ?? false);
  entry.terminal.focus();

  if (direction?.previous) {
    return entry.searchAddon.findPrevious(query, searchOptions);
  }

  return entry.searchAddon.findNext(query, searchOptions);
}

export function findInAllTerminals(
  query: string,
  options: TerminalSearchOptions,
  startSessionId?: string,
): string | null {
  const ids = getAllTerminalSessionIds();
  if (ids.length === 0 || !query.trim()) {
    return null;
  }

  const orderedIds = startSessionId
    ? [startSessionId, ...ids.filter((id) => id !== startSessionId)]
    : ids;

  for (const sessionId of orderedIds) {
    if (findInTerminal(sessionId, query, options)) {
      return sessionId;
    }
  }

  return null;
}

export function applySelectionToSearch(sessionId: string): string | null {
  const entry = terminals.get(sessionId);
  if (!entry?.terminal.hasSelection()) {
    return null;
  }

  const selection = entry.terminal.getSelection();
  return selection || null;
}

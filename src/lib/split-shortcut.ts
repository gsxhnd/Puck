const MODIFIER_PATTERN = /(⌘|⇧|⌥|⌃|Ctrl\+|Shift\+|Alt\+)/g;

/** Split a shortcut string into individual key tokens for per-key rendering. */
export function splitShortcutKeys(shortcut: string): string[] {
  const tokens: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MODIFIER_PATTERN.exec(shortcut)) !== null) {
    if (match.index > lastIndex) {
      const key = shortcut.slice(lastIndex, match.index);
      if (key) tokens.push(key);
    }
    tokens.push(match[0]);
    lastIndex = MODIFIER_PATTERN.lastIndex;
  }

  const tail = shortcut.slice(lastIndex);
  if (tail) tokens.push(tail);

  return tokens.length > 0 ? tokens : [shortcut];
}

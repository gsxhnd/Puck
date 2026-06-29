import { getPlatform } from "@/lib/platform";

export function formatShortcut(keys: string): string {
  const isMac = getPlatform() === "macos";
  return keys
    .replace(/⌘/g, isMac ? "⌘" : "Ctrl+")
    .replace(/⇧/g, isMac ? "⇧" : "Shift+")
    .replace(/⌥/g, isMac ? "⌥" : "Alt+");
}

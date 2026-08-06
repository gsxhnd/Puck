/**
 * Send a `cd` command to a connected terminal session.
 *
 * 向已连接的终端会话写入 `cd` 命令，用于文件浏览器与终端工作目录双向同步。
 */
import { writeTerminal } from "@/lib/tauri-terminal";

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Build a shell `cd` command that preserves `~` expansion. */
export function buildCdCommand(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "~") {
    return "cd ~\n";
  }
  if (trimmed.startsWith("~/")) {
    return `cd ~/${quoteShellArg(trimmed.slice(2))}\n`;
  }
  return `cd ${quoteShellArg(trimmed)}\n`;
}

/** Write a `cd` command into the given terminal session. */
export async function cdTerminalSession(
  sessionId: string,
  path: string,
): Promise<void> {
  await writeTerminal(sessionId, buildCdCommand(path));
}

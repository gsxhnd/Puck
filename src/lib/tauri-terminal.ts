import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isRecord } from "@/lib/ipc-parse";
import type {
  OpenLocalTerminalResult,
  ShellInfo,
  SystemIdentity,
  TerminalDataEvent,
  TerminalExitEvent,
} from "@/types/shell";

function parseShellInfo(value: unknown): ShellInfo | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.path !== "string" ||
    typeof value.kind !== "string"
  ) {
    return null;
  }
  const args = Array.isArray(value.args)
    ? value.args.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: value.id,
    name: value.name,
    path: value.path,
    kind: value.kind,
    args,
  };
}

function parseShellInfoArray(value: unknown): ShellInfo[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => parseShellInfo(item))
    .filter((item): item is ShellInfo => item !== null);
}

function parseSystemIdentity(value: unknown): SystemIdentity {
  if (!isRecord(value)) {
    throw new Error("Invalid system identity response");
  }
  if (typeof value.username !== "string" || typeof value.hostname !== "string") {
    throw new Error("Invalid system identity response");
  }
  return { username: value.username, hostname: value.hostname };
}

function parseOpenLocalTerminalResult(value: unknown): OpenLocalTerminalResult {
  if (!isRecord(value) || typeof value.sessionId !== "string") {
    throw new Error("Invalid open local terminal response");
  }
  const shell = parseShellInfo(value.shell);
  if (!shell) {
    throw new Error("Invalid open local terminal response");
  }
  return { sessionId: value.sessionId, shell };
}

function parseTerminalDataEvent(value: unknown): TerminalDataEvent | null {
  if (!isRecord(value)) return null;
  if (typeof value.sessionId !== "string" || typeof value.data !== "string") {
    return null;
  }
  return { sessionId: value.sessionId, data: value.data };
}

function parseTerminalExitEvent(value: unknown): TerminalExitEvent | null {
  if (!isRecord(value)) return null;
  if (typeof value.sessionId !== "string") return null;
  const code =
    value.code === null || typeof value.code === "number" ? value.code : null;
  return { sessionId: value.sessionId, code };
}

export async function listShells(): Promise<ShellInfo[]> {
  const result = await invoke<unknown>("list_shells");
  return parseShellInfoArray(result);
}

export async function getSystemIdentity(): Promise<SystemIdentity> {
  const result = await invoke<unknown>("get_system_identity");
  return parseSystemIdentity(result);
}

export async function openLocalTerminal(args: {
  sessionId: string;
  shellId?: string;
  cols: number;
  rows: number;
}): Promise<OpenLocalTerminalResult> {
  const result = await invoke<unknown>("open_local_terminal", args);
  return parseOpenLocalTerminalResult(result);
}

export function writeTerminal(sessionId: string, data: string): Promise<void> {
  return invoke("write_terminal", { sessionId, data });
}

export function resizeTerminal(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("resize_terminal", { sessionId, cols, rows });
}

export function closeSession(sessionId: string): Promise<void> {
  return invoke("close_session", { sessionId });
}

export function onTerminalData(
  handler: (event: TerminalDataEvent) => void,
): Promise<UnlistenFn> {
  return listen<unknown>("terminal:data", (event) => {
    const parsed = parseTerminalDataEvent(event.payload);
    if (parsed) handler(parsed);
  });
}

export function onTerminalExit(
  handler: (event: TerminalExitEvent) => void,
): Promise<UnlistenFn> {
  return listen<unknown>("terminal:exit", (event) => {
    const parsed = parseTerminalExitEvent(event.payload);
    if (parsed) handler(parsed);
  });
}

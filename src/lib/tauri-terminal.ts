import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  OpenLocalTerminalResult,
  ShellInfo,
  SystemIdentity,
  TerminalDataEvent,
  TerminalExitEvent,
} from "@/types/shell";

export function listShells(): Promise<ShellInfo[]> {
  return invoke<ShellInfo[]>("list_shells");
}

export function getSystemIdentity(): Promise<SystemIdentity> {
  return invoke<SystemIdentity>("get_system_identity");
}

export function openLocalTerminal(args: {
  sessionId: string;
  shellId?: string;
  cols: number;
  rows: number;
}): Promise<OpenLocalTerminalResult> {
  return invoke<OpenLocalTerminalResult>("open_local_terminal", args);
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
  return listen<TerminalDataEvent>("terminal:data", (event) => {
    handler(event.payload);
  });
}

export function onTerminalExit(
  handler: (event: TerminalExitEvent) => void,
): Promise<UnlistenFn> {
  return listen<TerminalExitEvent>("terminal:exit", (event) => {
    handler(event.payload);
  });
}

/**
 * Structured error parsing for Rust backend `PuckError` payloads.
 *
 * 解析 Rust 后端返回的结构化错误 JSON（`PuckError`），统一提取错误码、
 * 消息与详情；并提供 `isHostKeyError` 辅助判断 SSH 未知主机密钥场景。
 */
import type { TFunction } from "i18next";
import { isRecord } from "@/lib/ipc-parse";

export type HostKeyPrompt = {
  host: string;
  port: number;
  keyType: string;
  fingerprint: string;
  publicKey: string;
};

export type PuckErrorPayload = {
  code: string;
  message: string;
  details?: string;
  hostKey?: HostKeyPrompt;
};

function isHostKeyPrompt(value: unknown): value is HostKeyPrompt {
  if (!isRecord(value)) return false;
  return (
    typeof value.host === "string" &&
    typeof value.port === "number" &&
    typeof value.keyType === "string" &&
    typeof value.fingerprint === "string" &&
    typeof value.publicKey === "string"
  );
}

function isPuckErrorPayload(value: unknown): value is PuckErrorPayload {
  if (!isRecord(value)) return false;
  if (typeof value.code !== "string" || typeof value.message !== "string") {
    return false;
  }
  if (value.details !== undefined && typeof value.details !== "string") {
    return false;
  }
  if (value.hostKey !== undefined && !isHostKeyPrompt(value.hostKey)) {
    return false;
  }
  return true;
}

export function parsePuckError(error: unknown): PuckErrorPayload {
  if (typeof error === "string") {
    try {
      const parsed: unknown = JSON.parse(error);
      if (isPuckErrorPayload(parsed)) {
        return parsed;
      }
    } catch {
      return { code: "unknown_error", message: error };
    }
    return { code: "unknown_error", message: error };
  }

  if (isPuckErrorPayload(error)) {
    return error;
  }

  if (isRecord(error) && typeof error.message === "string") {
    return {
      code: typeof error.code === "string" ? error.code : "unknown_error",
      message: error.message,
      details: typeof error.details === "string" ? error.details : undefined,
    };
  }

  return {
    code: "unknown_error",
    message: error instanceof Error ? error.message : "Unknown error",
  };
}

export function formatPuckErrorMessage(
  t: TFunction,
  error: unknown,
): string {
  const payload = parsePuckError(error);
  const message = t(`errors:${payload.code}`, {
    defaultValue: payload.message,
  });
  if (payload.details) {
    return `${message} (${payload.details})`;
  }
  return message;
}

export function isHostKeyError(error: unknown): HostKeyPrompt | null {
  const payload = parsePuckError(error);
  return payload.code === "host_key_unknown" && payload.hostKey
    ? payload.hostKey
    : null;
}

/**
 * Structured error parsing for Rust backend `PuckError` payloads.
 *
 * 解析 Rust 后端返回的结构化错误 JSON（`PuckError`），统一提取错误码、
 * 消息与详情；并提供 `isHostKeyError` 辅助判断 SSH 未知主机密钥场景。
 */
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

export function parsePuckError(error: unknown): PuckErrorPayload {
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error) as PuckErrorPayload;
      if (parsed.code && parsed.message) {
        return parsed;
      }
    } catch {
      return { code: "unknown_error", message: error };
    }
    return { code: "unknown_error", message: error };
  }
  return {
    code: "unknown_error",
    message: error instanceof Error ? error.message : "Unknown error",
  };
}

export function isHostKeyError(error: unknown): HostKeyPrompt | null {
  const payload = parsePuckError(error);
  return payload.code === "host_key_unknown" && payload.hostKey
    ? payload.hostKey
    : null;
}

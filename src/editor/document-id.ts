/**
 * Stable identifiers for editor documents.
 *
 * 编辑器文档的稳定标识符。documentId 将来源（本地/SFTP）、会话与路径编码为
 * 一个字符串，用于标签、Monaco Model 与后续高亮 Worker 之间的关联。运行时
 * 会话 id 为 UUID（不含冒号），因此用冒号分段是安全的；路径本身可以包含冒号。
 */
import type { DocumentSource } from "@/types/workbench";

/** A decoded document identity. / 解析后的文档身份。 */
export type EditorDocumentRef = {
  source: DocumentSource;
  path: string;
  sessionId?: string;
};

/** Builds a document id from a reference. / 从文档引用构造 documentId。 */
export function buildDocumentId(ref: EditorDocumentRef): string {
  if (ref.source === "local") {
    return `local:${ref.path}`;
  }
  if (!ref.sessionId) {
    throw new Error("Remote document requires a sessionId");
  }
  return `remote:${ref.sessionId}:${ref.path}`;
}

/**
 * Parses a document id back into its reference.
 *
 * 把 documentId 解析回文档引用；格式非法时返回 null。远程 id 形如
 * `remote:<sessionId>:<path>`，path 段允许包含冒号（例如 Windows 盘符）。
 */
export function parseDocumentId(documentId: string): EditorDocumentRef | null {
  const prefixEnd = documentId.indexOf(":");
  if (prefixEnd < 0) return null;

  const prefix = documentId.slice(0, prefixEnd);
  if (prefix === "local") {
    const path = documentId.slice(prefixEnd + 1);
    return path ? { source: "local", path } : null;
  }

  if (prefix !== "remote") return null;

  const rest = documentId.slice(prefixEnd + 1);
  const sessionEnd = rest.indexOf(":");
  if (sessionEnd <= 0) return null;

  const sessionId = rest.slice(0, sessionEnd);
  const path = rest.slice(sessionEnd + 1);
  if (!path) return null;

  return { source: "remote", path, sessionId };
}

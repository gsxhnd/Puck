/**
 * Reference-counted SFTP sessions owned by editor documents.
 *
 * 编辑器文档持有的 SFTP 会话注册表（引用计数）。远程文档打开期间，编辑器
 * 为每个连接独占一个 `editor:<connectionId>` SFTP 会话，与 explorer 会话
 * 完全解耦——关闭文件浏览面板不会中断正在编辑的远程文件。引用计数归零时
 * 才释放后端会话。
 */
import type { ConnectionProfile } from "@/types/connection";
import { closeSession } from "@/lib/tauri-terminal";
import {
  editorSftpSessionId,
  ensureSftpSession,
} from "@/lib/sftp-explorer-session";

const refCounts = new Map<string, number>();

/**
 * Acquires (creates on first use) the editor-owned SFTP session for a
 * connection. Throws when credentials are cancelled or the connection fails;
 * the reference count is rolled back on failure.
 *
 * 获取（首次使用时创建）某连接的编辑器独占 SFTP 会话。凭据取消或连接失败
 * 时抛出错误，并回滚引用计数。
 */
export async function acquireEditorSftpSession(
  profile: ConnectionProfile,
): Promise<string> {
  const sessionId = editorSftpSessionId(profile.id);
  refCounts.set(sessionId, (refCounts.get(sessionId) ?? 0) + 1);

  try {
    await ensureSftpSession(sessionId, profile);
  } catch (error) {
    // Roll back one acquisition without clobbering concurrent increments.
    // 失败时回退一次占用，避免覆盖并发增加的计数。
    const current = refCounts.get(sessionId) ?? 1;
    if (current <= 1) {
      refCounts.delete(sessionId);
    } else {
      refCounts.set(sessionId, current - 1);
    }
    throw error;
  }

  return sessionId;
}

/**
 * Releases one reference; closes the backend session when the last document
 * using it is closed. Sessions not tracked here (explorer sessions) are
 * ignored.
 *
 * 释放一次引用；最后一个使用该会话的文档关闭时释放后端会话。未登记在本
 * 注册表中的会话（explorer 会话）直接忽略。
 */
export function releaseEditorSftpSession(sessionId: string): void {
  const current = refCounts.get(sessionId);
  if (!current) return;

  if (current <= 1) {
    refCounts.delete(sessionId);
    void closeSession(sessionId).catch(() => {
      // The SFTP session may already be gone (e.g. connection dropped).
      // 会话可能已因连接断开而消失，忽略关闭失败。
    });
    return;
  }

  refCounts.set(sessionId, current - 1);
}

/** Current reference count for a session (diagnostics/tests). / 指定会话的当前引用计数（诊断/测试用）。 */
export function editorSftpRefCount(sessionId: string): number {
  return refCounts.get(sessionId) ?? 0;
}

/**
 * Entry point for opening files as workbench editor tabs.
 *
 * 在主窗口工作台以编辑器标签打开文件的入口。本地文件直接注册文档；远程
 * 文件优先使用编辑器独占的 `editor:<connectionId>` SFTP 会话（引用计数保活，
 * 关闭文件浏览面板不会中断编辑），documentId 以 connectionId 为键保证同一
 * 文件跨 explorer 会话去重。独立 editor 窗口入口保留在
 * `open-editor-window.ts`，迁移完成前两者并存。
 */
import { toast } from "sonner";
import type { ConnectionProfile } from "@/types/connection";
import { buildDocumentId } from "@/editor/document-id";
import { getEditorDocumentManager } from "@/editor/editor-document-manager";
import { acquireEditorSftpSession, releaseEditorSftpSession } from "@/editor/remote-session-registry";
import {
  fileNameFromPath,
  guessMonacoLanguage,
  type EditorFileSource,
} from "@/lib/editor-params";
import { parsePuckError } from "@/lib/puck-error";
import { useWorkbenchStore } from "@/stores/workbench-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

function isTabOpen(documentId: string): boolean {
  return useWorkbenchStore
    .getState()
    .tabs.some((tab) => tab.id === documentId);
}

function activateTab(documentId: string): void {
  useWorkbenchStore.getState().setActiveTab(documentId);
}

function activeWorkspaceId(): string | undefined {
  return useWorkspaceStore.getState().activeWorkspace?.id;
}

/** Opens a local or SFTP file as an editor tab in the main window. / 在主窗口以编辑器标签打开本地或 SFTP 文件。 */
export function openFileInWorkbench(args: {
  path: string;
  source: EditorFileSource;
  sessionId?: string;
  /** Enables the editor-owned SFTP session for remote documents. / 远程文档启用编辑器独占 SFTP 会话时传入连接配置。 */
  profile?: ConnectionProfile;
}): void {
  const { path, source, sessionId, profile } = args;
  const manager = getEditorDocumentManager();
  const language = guessMonacoLanguage(path);

  if (source === "remote") {
    // Stable identity: connection id when available, explorer session id as
    // the compatibility fallback.
    // 稳定身份：优先 connectionId，兼容回退到 explorer sessionId。
    const identity = profile?.id ?? sessionId;
    if (!identity) return;

    const documentId = buildDocumentId({
      source: "remote",
      path,
      sessionId: identity,
    });

    // Already open: just focus the existing tab. 已打开：仅聚焦现有标签。
    if (isTabOpen(documentId)) {
      activateTab(documentId);
      return;
    }

    void (async () => {
      let ioSessionId = sessionId ?? "";
      if (profile) {
        try {
          ioSessionId = await acquireEditorSftpSession(profile);
        } catch (error) {
          toast.error(parsePuckError(error).message);
          return;
        }
      }
      if (!ioSessionId) return;

      // Re-check after the async acquire to avoid duplicate tabs (which would
      // also leak a reference count).
      // 异步获取后再次检查，避免重复标签（同时避免泄漏引用计数）。
      if (isTabOpen(documentId)) {
        if (profile) releaseEditorSftpSession(ioSessionId);
        activateTab(documentId);
        return;
      }

      void manager.open({
        documentId,
        source: "remote",
        path,
        sessionId: ioSessionId,
        language,
      });
      useWorkbenchStore.getState().openEditorTab({
        kind: "editor",
        id: documentId,
        title: fileNameFromPath(path),
        path,
        workspaceId: activeWorkspaceId(),
      });
    })();
    return;
  }

  const documentId = buildDocumentId({ source: "local", path });
  if (isTabOpen(documentId)) {
    activateTab(documentId);
    return;
  }

  // Fire-and-forget: loading progress and errors surface in the editor area.
  // 无需等待加载完成：加载进度与错误由编辑器区域展示。
  void manager.open({
    documentId,
    source: "local",
    path,
    language,
  });
  useWorkbenchStore.getState().openEditorTab({
    kind: "editor",
    id: documentId,
    title: fileNameFromPath(path),
    path,
    workspaceId: activeWorkspaceId(),
  });
}

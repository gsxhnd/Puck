/**
 * Shared actions for workbench tabs.
 *
 * 工作台标签的共享操作：保存（仅编辑器标签）、关闭（编辑器标签含 dirty
 * 确认，Diff 标签直接关闭）。编辑器区域与命令面板共用同一实现，避免行为
 * 分叉；文案通过 i18n 实例直接取值（非 React 环境）。
 */
import i18n from "@/i18n";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { getEditorDocumentManager } from "@/editor/editor-document-manager";
import { releaseEditorSftpSession } from "@/editor/remote-session-registry";
import { forgetRemoteDesktopSession } from "@/lib/remote-desktop-session";
import { parsePuckError } from "@/lib/puck-error";
import { useRemoteDesktopCertStore } from "@/stores/remote-desktop-cert-store";
import { useWorkbenchStore } from "@/stores/workbench-store";

/**
 * Saves the active editor tab. Returns false when there is nothing to save
 * (no active tab, the active tab is a diff, not ready, or not dirty) or when
 * saving failed.
 * 保存当前激活的编辑器标签。无可保存内容（无激活标签/激活的是 Diff 标签/
 * 未就绪/非 dirty）或保存失败时返回 false；失败时保留 dirty 状态并弹出
 * 错误提示。
 */
export async function saveActiveEditorTab(): Promise<boolean> {
  const { tabs, activeTabId } = useWorkbenchStore.getState();
  if (!activeTabId) return false;

  // Diff tabs are read-only; only editor tabs save. Diff 标签只读，仅编辑器标签可保存。
  const active = tabs.find((item) => item.id === activeTabId);
  if (active?.kind !== "editor") return false;

  const manager = getEditorDocumentManager();
  const doc = manager.get(activeTabId);
  if (!doc || doc.loadState !== "ready" || !doc.dirty) return false;

  try {
    await manager.save(activeTabId);
    toast.success(i18n.t("editor:saved"));
    return true;
  } catch (error) {
    toast.error(parsePuckError(error).message);
    return false;
  }
}

/**
 * Closes a tab. Editor tabs prompt for confirmation when dirty.
 * 关闭标签；编辑器标签 dirty 时先弹出确认框，用户取消则不关闭。
 */
export function closeTabWithConfirm(tabId: string): void {
  const { tabs } = useWorkbenchStore.getState();
  const tab = tabs.find((item) => item.id === tabId);

  const manager = getEditorDocumentManager();
  if (tab?.kind === "editor") {
    const doc = manager.get(tabId);
    if (doc?.dirty && !window.confirm(i18n.t("editor:confirmCloseDirty"))) {
      return;
    }
    manager.close(tabId);
    // Release the editor-owned SFTP session; explorer sessions are ignored by
    // the registry.
    // 释放编辑器独占的 SFTP 会话；explorer 会话会被注册表忽略。
    if (doc?.meta.source === "remote" && doc.meta.sessionId) {
      releaseEditorSftpSession(doc.meta.sessionId);
    }
  }

  // Best-effort backend cleanup for remote desktop tabs; the skeleton backend
  // already removes the session on failure.
  // 远程桌面标签的后端清理（尽力而为）；骨架后端在失败时已自行清理。
  if (tab?.kind === "remoteDesktop") {
    void invoke("stop_remote_desktop", { sessionId: tab.sessionId }).catch(
      () => {
        // Ignore stop failures. 忽略停止失败。
      },
    );
    forgetRemoteDesktopSession(tab.sessionId);
    useRemoteDesktopCertStore.getState().clearPrompt(tab.sessionId);
  }

  useWorkbenchStore.getState().closeTab(tabId);
}

/** Closes the active tab, if any. / 关闭当前激活的标签（如有）。 */
export function closeActiveTab(): void {
  const { activeTabId } = useWorkbenchStore.getState();
  if (activeTabId) {
    closeTabWithConfirm(activeTabId);
  }
}

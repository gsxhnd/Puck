/**
 * Workbench tab area inside the main window.
 *
 * 主窗口工作台的标签区域：顶部标签条（编辑器 + Diff）+ 当前激活标签内容。
 * 编辑器标签通过 useSyncExternalStore 订阅 EditorDocumentManager 快照；Diff
 * 标签从 diff-content 注册表读取对比文本。没有打开的标签时不渲染任何内容，
 * 主面板保持原有终端布局。保存与关闭行为使用共享 actions
 * （workbench-editor-actions），与命令面板保持一致。
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { MonitorIcon, SaveIcon, XIcon } from "lucide-react";
import { MonacoDiffPane } from "@/components/editor/monaco-diff-pane";
import { MonacoEditorPane } from "@/components/editor/monaco-editor-pane";
import { RemoteDesktopCertDialog } from "@/components/workbench/remote-desktop-cert-dialog";
import { Button } from "@/components/ui/button";
import { getDiffContent } from "@/editor/diff-content";
import { getEditorDocumentManager } from "@/editor/editor-document-manager";
import type { EditorDocumentSnapshot } from "@/editor/editor-document-manager";
import {
  closeTabWithConfirm,
  saveActiveEditorTab,
} from "@/lib/workbench-editor-actions";
import { getEffectiveTheme } from "@/lib/theme-utils";
import { cn } from "@/lib/utils";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useWorkbenchStore } from "@/stores/workbench-store";

const documentManager = getEditorDocumentManager();

/**
 * Subscribes to the document manager and returns the active document snapshot.
 * 订阅文档管理器并返回指定文档的快照；revision 变化时重新读取。
 */
function useEditorDocumentSnapshot(
  documentId: string | null,
): EditorDocumentSnapshot | null {
  const subscribe = useCallback(
    (listener: () => void) => documentManager.subscribe(listener),
    [],
  );
  const revision = useSyncExternalStore(
    subscribe,
    () => documentManager.getRevision(),
    () => documentManager.getRevision(),
  );
  return useMemo(
    () => (documentId ? documentManager.get(documentId) : null),
    // revision 仅用于触发重算；快照在 manager 内部是不可变对象。
    [documentId, revision],
  );
}

export function WorkbenchTabArea() {
  const { t } = useTranslation(["editor", "remoteDesktop"]);
  const tabs = useWorkbenchStore((state) => state.tabs);
  const activeTabId = useWorkbenchStore((state) => state.activeTabId);
  const setActiveTab = useWorkbenchStore((state) => state.setActiveTab);
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const monacoTheme =
    getEffectiveTheme(themeMode) === "dark" ? "vs-dark" : "vs";

  const activeTab = tabs.find((item) => item.id === activeTabId) ?? null;
  const activeSnapshot = useEditorDocumentSnapshot(
    activeTab?.kind === "editor" ? activeTab.id : null,
  );
  const diffContent =
    activeTab?.kind === "diff" ? getDiffContent(activeTab.id) : null;

  const saveActive = useCallback(() => {
    void saveActiveEditorTab();
  }, []);

  // Cmd/Ctrl+S saves the active workbench document. Keys pressed inside an
  // xterm instance (target within .xterm) are left untouched so the shell
  // still receives its own control sequences.
  // Cmd/Ctrl+S 保存当前工作台文档；在 xterm 内按键不拦截，保证控制序列
  // 仍能送达 shell。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeTabId) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "s") return;

      const target = event.target as HTMLElement | null;
      if (target?.closest(".xterm")) return;

      event.preventDefault();
      saveActive();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTabId, saveActive]);

  if (tabs.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col border-b border-border/60">
      <div className="flex items-center gap-1 border-b border-border/60 bg-shell-main px-1.5 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const dirty =
              tab.kind === "editor"
                ? (documentManager.get(tab.id)?.dirty ?? false)
                : false;
            const active = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={cn(
                  "group flex max-w-56 shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                  active
                    ? "border-border bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-background/60",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 truncate"
                  title={tab.kind === "remoteDesktop" ? tab.host : tab.path}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.title}
                  {dirty ? <span className="ml-1">•</span> : null}
                </button>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={t("closeTab")}
                  className="rounded p-0.5 opacity-60 hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTabWithConfirm(tab.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      closeTabWithConfirm(tab.id);
                    }
                  }}
                >
                  <XIcon className="size-3" />
                </span>
              </div>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="xs"
          disabled={!activeSnapshot?.dirty || activeSnapshot?.saving || false}
          onClick={saveActive}
        >
          <SaveIcon />
          {t("save")}
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab?.kind === "editor" ? (
          activeSnapshot ? (
            activeSnapshot.loadState === "loading" ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("loading")}
              </div>
            ) : activeSnapshot.loadState === "error" ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
                {activeSnapshot.loadError ?? t("missingParams")}
              </div>
            ) : (
              <MonacoEditorPane
                value={activeSnapshot.content}
                language={activeSnapshot.meta.language}
                theme={monacoTheme}
                onChange={(value) => {
                  documentManager.markEdited(
                    activeSnapshot.meta.documentId,
                    value,
                  );
                }}
              />
            )
          ) : null
        ) : activeTab?.kind === "diff" ? (
          diffContent ? (
            <MonacoDiffPane
              original={diffContent.original}
              modified={diffContent.modified}
              language={activeTab.language}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("diffUnavailable")}
            </div>
          )
        ) : null}
        {activeTab?.kind === "remoteDesktop" ? (
          // Remote desktop placeholder: connection state machine and error
          // surface; the graphics canvas arrives with the protocol backend.
          // 远程桌面占位视图：连接状态机与错误展示；图形画布随协议后端接入。
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <MonitorIcon className="size-8 text-muted-foreground" />
            {activeTab.status === "connecting" ? (
              <p className="text-sm text-muted-foreground">
                {t("remoteDesktop:connecting")}
              </p>
            ) : null}
            {activeTab.status === "connected" ? (
              <p className="text-sm text-muted-foreground">
                {t("remoteDesktop:connected")}
              </p>
            ) : null}
            {activeTab.status === "failed" ? (
              <>
                <p className="text-sm text-destructive">
                  {t("remoteDesktop:failed")}
                </p>
                {activeTab.errorMessage ? (
                  <p className="max-w-lg break-words text-xs text-muted-foreground">
                    {activeTab.errorMessage}
                  </p>
                ) : null}
                <p className="max-w-lg text-xs text-muted-foreground">
                  {t("remoteDesktop:backendPending")}
                </p>
              </>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {t("remoteDesktop:hostLabel")}: {activeTab.host} ·{" "}
              {activeTab.protocol.toUpperCase()}
            </p>
          </div>
        ) : null}
      </div>
      <RemoteDesktopCertDialog />
    </div>
  );
}

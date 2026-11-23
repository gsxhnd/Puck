/**
 * Workbench tab area inside the main window.
 *
 * 主窗口工作台的标签区域：顶部标签条（编辑器 / Diff / Git Graph）+ 当前激活
 * 标签内容。编辑器标签通过 useSyncExternalStore 订阅 EditorDocumentManager
 * 快照；Diff 标签从 diff-content 注册表读取对比文本。保存与关闭行为使用共享
 * actions（workbench-editor-actions），与命令面板保持一致。
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FileCode2Icon, GitForkIcon, PlusIcon, XIcon } from "lucide-react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { MonacoDiffPane } from "@/components/editor/monaco-diff-pane";
import { MonacoEditorPane } from "@/components/editor/monaco-editor-pane";
import { GitGraph } from "@/components/workspace/git-graph";
import { Button } from "@/components/ui/button";
import { getDiffContent } from "@/editor/diff-content";
import { getEditorDocumentManager } from "@/editor/editor-document-manager";
import type { EditorDocumentSnapshot } from "@/editor/editor-document-manager";
import { openFileInWorkbench } from "@/lib/open-in-workbench";
import {
  closeTabWithConfirm,
  saveActiveEditorTab,
} from "@/lib/workbench-editor-actions";
import { isTauri } from "@/lib/platform";
import { getEffectiveTheme } from "@/lib/theme-utils";
import { cn } from "@/lib/utils";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useWorkbenchStore, workbenchTabsForWorkspace } from "@/stores/workbench-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

const documentManager = getEditorDocumentManager();

function fileExtension(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  const name = segments[segments.length - 1] ?? path;
  if (name.startsWith(".") && !name.slice(1).includes(".")) return "";
  const parts = name.split(".");
  return parts[parts.length - 1] ?? "";
}

function FileBadge({ path }: { path: string }) {
  const extension = fileExtension(path);
  if (!extension) {
    return <FileCode2Icon className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[8px] font-semibold uppercase text-primary">
      {extension.slice(0, 4)}
    </span>
  );
}

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

type WorkbenchTabAreaProps = {
  /** Content shown when no workbench tab is active. */
  children?: ReactNode;
};

export function WorkbenchTabArea({ children }: WorkbenchTabAreaProps) {
  const { t } = useTranslation(["common", "editor"]);
  const tabs = useWorkbenchStore((state) => state.tabs);
  const activeTabId = useWorkbenchStore((state) => state.activeTabId);
  const setActiveTab = useWorkbenchStore((state) => state.setActiveTab);
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const workspaceId = workspace?.id;
  const monacoTheme =
    getEffectiveTheme(themeMode) === "dark" ? "vs-dark" : "vs";

  const visibleTabs = useMemo(
    () => workbenchTabsForWorkspace(tabs, workspaceId),
    [tabs, workspaceId],
  );
  const activeTab = visibleTabs.find((item) => item.id === activeTabId) ?? null;

  // Workspace switches must never leave a hidden tab active. Switching back
  // restores the first visible tab until the user selects another one.
  // 切换 Workspace 时不能保留隐藏标签为激活态；切回后先激活首个可见标签。
  useEffect(() => {
    if (visibleTabs.some((tab) => tab.id === activeTabId)) return;
    setActiveTab(visibleTabs[0]?.id ?? null);
  }, [activeTabId, setActiveTab, visibleTabs]);
  const activeSnapshot = useEditorDocumentSnapshot(
    activeTab?.kind === "editor" ? activeTab.id : null,
  );
  const diffContent =
    activeTab?.kind === "diff" ? getDiffContent(activeTab.id) : null;

  const saveActive = useCallback(() => {
    void saveActiveEditorTab();
  }, []);

  const openEditorFile = useCallback(async () => {
    const selected = await openFileDialog({ multiple: false, directory: false });
    if (typeof selected === "string") {
      openFileInWorkbench({ path: selected, source: "local" });
    }
  }, []);

  // Cmd/Ctrl+S saves the active workbench document. Keys pressed inside an
  // xterm instance (target within .xterm) are left untouched so the shell
  // still receives its own control sequences.
  // Cmd/Ctrl+S 保存当前工作台文档；在 xterm 内按键不拦截，保证控制序列
  // 仍能送达 shell。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeTab) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "s") return;

      const target = event.target as HTMLElement | null;
      if (target?.closest(".xterm")) return;

      event.preventDefault();
      saveActive();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, saveActive]);

  // The parent is the Panel inner div (display: block), so this root needs an
  // explicit h-full — flex-1 alone would collapse the editor to zero height.
  // 父级是 Panel 的内层 div（display: block），必须显式 h-full，否则编辑器会
  // 因 flex-1 失效而塌陷为 0 高度。
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const dirty =
              tab.kind === "editor"
                ? (documentManager.get(tab.id)?.dirty ?? false)
                : false;
            const active = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={cn(
                  "group flex h-7 max-w-52 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs",
                  active
                    ? "bg-background text-foreground ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {tab.kind === "gitGraph" ? (
                  <GitForkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileBadge path={tab.path} />
                )}
                <button
                  type="button"
                  className="min-w-0 truncate"
                  title={tab.path}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.title}
                  {dirty ? <span className="ml-1">•</span> : null}
                </button>
                <button
                  type="button"
                  aria-label={t("editor:closeTab")}
                  title={t("editor:closeTab")}
                  className="rounded p-0.5 text-muted-foreground opacity-70 hover:bg-muted hover:text-foreground hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTabWithConfirm(tab.id);
                  }}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            );
          })}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("editor:openFile")}
            title={t("editor:openFile")}
            disabled={!isTauri() || workspace?.source === "remote"}
            onClick={() => void openEditorFile()}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab?.kind === "editor" ? (
          activeSnapshot ? (
            activeSnapshot.loadState === "loading" ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("editor:loading")}
              </div>
            ) : activeSnapshot.loadState === "error" ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
                {activeSnapshot.loadError ?? t("editor:missingParams")}
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
              {t("editor:diffUnavailable")}
            </div>
          )
        ) : activeTab?.kind === "gitGraph" ? (
          <GitGraph
            path={activeTab.path}
            source={activeTab.source}
            connectionId={activeTab.connectionId}
          />
        ) : children}
      </div>
    </div>
  );
}

/**
 * Bottom status bar for workspace, Git and active editor metadata.
 *
 * 底部状态栏：显示工作区路径、本地/远程来源、Git 分支及活动文档语言。
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { GitBranchIcon, ServerIcon } from "lucide-react";
import { getEditorDocumentManager } from "@/editor/editor-document-manager";
import { guessMonacoLanguage } from "@/lib/editor-params";
import { gitStatus } from "@/lib/tauri-git";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useWorkbenchStore, workbenchTabsForWorkspace } from "@/stores/workbench-store";

const documentManager = getEditorDocumentManager();

export function WorkspaceStatusBar() {
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const remoteStatus = useWorkspaceStore((state) => state.remoteStatus);
  const tabs = useWorkbenchStore((state) => state.tabs);
  const activeTabId = useWorkbenchStore((state) => state.activeTabId);
  const visibleTabs = workbenchTabsForWorkspace(tabs, workspace?.id);
  const selectedTab = visibleTabs.find((tab) => tab.id === activeTabId);
  const activeTab = selectedTab?.kind === "editor" ? selectedTab : null;
  const [branch, setBranch] = useState<string | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => documentManager.subscribe(listener),
    [],
  );
  useSyncExternalStore(
    subscribe,
    () => documentManager.getRevision(),
    () => documentManager.getRevision(),
  );

  useEffect(() => {
    let cancelled = false;
    setBranch(null);
    if (!workspace) return;
    if (workspace.source === "remote" && remoteStatus !== "connected") return;
    const connectionId = workspace.source === "remote" ? workspace.profileId : undefined;
    void gitStatus(workspace.rootPath, connectionId)
      .then((status) => {
        if (!cancelled) setBranch(status.isRepo ? (status.branch ?? "HEAD") : null);
      })
      .catch(() => {
        if (!cancelled) setBranch(null);
      });
    return () => {
      cancelled = true;
    };
  }, [remoteStatus, workspace]);

  const document = activeTab ? documentManager.get(activeTab.id) : null;
  const language = useMemo(
    () => (activeTab ? guessMonacoLanguage(activeTab.path) : null),
    [activeTab],
  );
  const relativePath = activeTab && workspace
    ? activeTab.path.startsWith(`${workspace.rootPath}/`)
      ? activeTab.path.slice(workspace.rootPath.length + 1)
      : activeTab.path
    : workspace?.rootPath;

  return (
    <footer className="flex h-6 shrink-0 items-center gap-2 border-t border-border/60 bg-shell-primary px-3 text-[10px] text-muted-foreground select-none">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {workspace?.source === "remote" ? <ServerIcon className="size-3 shrink-0" /> : null}
        <span className="truncate font-mono">{relativePath ?? "Puck"}</span>
        {document?.dirty ? <span aria-label="Unsaved">•</span> : null}
      </div>
      {branch ? (
        <span className="flex shrink-0 items-center gap-1">
          <GitBranchIcon className="size-3" />
          {branch}
        </span>
      ) : null}
      {language ? <span className="shrink-0 uppercase">{language}</span> : null}
      <span className="shrink-0">UTF-8</span>
      <span className="shrink-0 uppercase">{workspace?.source ?? "local"}</span>
    </footer>
  );
}

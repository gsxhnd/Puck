/**
 * Bottom status bar styled as a workspace breadcrumb and editor metadata strip.
 *
 * 底部状态栏：左侧显示 Workspace → 相对路径面包屑，右侧显示 Git、换行符、
 * 编码、缩进与语言等当前编辑器元数据。
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRightIcon, GitBranchIcon, SettingsIcon, SquareTerminalIcon } from "lucide-react";
import { getEditorDocumentManager } from "@/editor/editor-document-manager";
import { guessMonacoLanguage } from "@/lib/editor-params";
import { gitStatus } from "@/lib/tauri-git";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { toggleTerminalPanel } from "@/lib/workspace-actions";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useWorkbenchStore, workbenchTabsForWorkspace } from "@/stores/workbench-store";
import type { Workspace } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const documentManager = getEditorDocumentManager();

function pathSegments(path: string): string[] {
  return path.split(/[\\/]/).filter(Boolean);
}

function relativeSegments(workspace: Workspace, path: string): string[] {
  const root = workspace.rootPath.replace(/[\\/]+$/, "");
  const normalized = path.replace(/[\\/]+$/, "");
  if (!path || normalized === root) return [];

  if (root === "~" && path.startsWith("~/")) {
    return pathSegments(path.slice(2));
  }
  if (root === "/" && path.startsWith("/")) {
    return pathSegments(path);
  }
  if (path.startsWith(`${root}/`)) {
    return pathSegments(path.slice(root.length + 1));
  }
  if (path.startsWith(`${root}\\`)) {
    return pathSegments(path.slice(root.length + 1));
  }
  return pathSegments(path);
}

function breadcrumbSegments(
  workspace: Workspace | null,
  activePath: string | null,
): string[] {
  if (!workspace) return ["Puck"];
  const relative = activePath ? relativeSegments(workspace, activePath) : [];
  return [workspace.name, ...relative];
}

export function WorkspaceStatusBar() {
  const { t } = useTranslation("common");
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const remoteStatus = useWorkspaceStore((state) => state.remoteStatus);
  const terminalOpen = useWorkspaceStore((state) => state.terminalOpen);
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
  const lineEnding = document?.content.includes("\r\n") ? "CRLF" : "LF";
  const breadcrumb = useMemo(
    () => breadcrumbSegments(workspace, activeTab?.path ?? null),
    [activeTab?.path, workspace],
  );

  return (
    <footer
      // Full-bleed strip on the shell base; the border above separates it
      // from the islanded content without creating a floating gap.
      // 通栏贴边条，底色与外壳一致；仅用上边线与内容区分隔，不产生悬浮间隙。
      className="flex h-7 shrink-0 items-center gap-3 border-t border-border/60 px-3 text-[10px] text-muted-foreground select-none"
    >
      <div className="flex min-w-0 flex-1 items-center gap-0.5">
        {breadcrumb.map((segment, index) => {
          const last = index === breadcrumb.length - 1;
          return (
            <span key={`${segment}-${index}`} className="flex min-w-0 items-center gap-0.5">
              {index > 0 ? (
                <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/60" />
              ) : null}
              <span
                className={last ? "truncate text-foreground/80" : "shrink-0 truncate"}
                title={segment}
              >
                {segment}
              </span>
            </span>
          );
        })}
        {document?.dirty ? <span className="ml-1.5">•</span> : null}
      </div>

      {branch ? (
        <span className="flex shrink-0 items-center gap-1">
          <GitBranchIcon className="size-3" />
          {branch}
        </span>
      ) : null}
      <span className="shrink-0">4:1</span>
      <span className="shrink-0">{lineEnding}</span>
      <span className="shrink-0">UTF-8</span>
      <span className="shrink-0">{t("workspace.indent", { count: 4 })}</span>
      {language ? <span className="shrink-0 uppercase">{language}</span> : null}

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={terminalOpen ? t("workspace.hideTerminal") : t("workspace.showTerminal")}
          title={terminalOpen ? t("workspace.hideTerminal") : t("workspace.showTerminal")}
          onClick={toggleTerminalPanel}
        >
          <SquareTerminalIcon className={cn(terminalOpen && "text-foreground")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("actions.settings")}
          title={t("actions.settings")}
          onClick={() => void openSettingsWindow()}
        >
          <SettingsIcon />
        </Button>
      </div>
    </footer>
  );
}

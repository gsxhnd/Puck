/**
 * Editor-first workspace with an independent, equally capable terminal area.
 *
 * 主工作区：上方为编辑器/Diff 标签，下方为独立终端。两个区域可独立使用，
 * 通过可拖拽分隔条调整比例，不再由终端 Session 决定整个主窗口。
 */
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FileCode2Icon,
  FolderOpenIcon,
  PanelBottomIcon,
  PanelLeftIcon,
  SearchIcon,
  SettingsIcon,
  SquareTerminalIcon,
} from "lucide-react";
import { WorkbenchTabArea } from "@/components/workbench/workbench-tab-area";
import { WorkspaceTerminal } from "@/components/workspace/workspace-terminal";
import { WorkspaceStatusBar } from "@/components/workspace/workspace-status-bar";
import { PanelHeader } from "@/layout/app-shell/panel-header";
import { WindowControls } from "@/layout/app-shell/window-controls";
import { chooseLocalWorkspace, createWorkspaceTerminal } from "@/lib/workspace-actions";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { getPlatform } from "@/lib/platform";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSessionStore } from "@/stores/session-store";
import { useShellLayoutStore } from "@/stores/shell-layout-store";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";
import { useTerminalSplitStore } from "@/stores/terminal-split-store";
import { useWorkbenchStore, workbenchTabsForWorkspace } from "@/stores/workbench-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

function EditorEmptyState() {
  const { t } = useTranslation("common");
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
        {workspace ? <FileCode2Icon className="size-5" /> : <FolderOpenIcon className="size-5" />}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">
          {workspace ? t("workspace.editorEmptyTitle") : t("workspace.welcomeTitle")}
        </h2>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          {workspace ? t("workspace.editorEmptyDescription") : t("workspace.welcomeDescription")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void chooseLocalWorkspace()}>
          <FolderOpenIcon data-icon="inline-start" />
          {t("workspace.openLocal")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void createWorkspaceTerminal()}>
          <SquareTerminalIcon data-icon="inline-start" />
          {t("actions.newTerminal")}
        </Button>
      </div>
    </div>
  );
}

export function MainPanel() {
  const { t } = useTranslation("common");
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen);
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);
  const terminalOpen = useWorkspaceStore((state) => state.terminalOpen);
  const toggleTerminal = useWorkspaceStore((state) => state.toggleTerminal);
  const tabCount = useWorkbenchStore((state) =>
    workbenchTabsForWorkspace(state.tabs, workspace?.id).length,
  );
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const openPalette = useCommandPaletteStore((state) => state.openPalette);
  const openSearch = useTerminalSearchStore((state) => state.openSearch);
  const splitSession = useTerminalSplitStore((state) => state.splitSession);
  const syncSplit = useTerminalSplitStore((state) => state.syncWithSessions);
  const setLayout = useShellLayoutStore((state) => state.setLayout);
  const defaultLayout = useMemo(
    () => useShellLayoutStore.getState().getDefaultLayout(),
    [],
  );

  useEffect(() => {
    syncSplit(sessions.map((session) => session.id));
  }, [sessions, syncSplit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "j") {
        event.preventDefault();
        toggleTerminal();
        return;
      }
      if (key === "b") {
        event.preventDefault();
        toggleSidebar();
        return;
      }
      if (!activeSession || activeSession.kind !== "terminal") return;
      if (key === "d") {
        event.preventDefault();
        if (!activeSessionId) return;
        splitSession(
          activeSessionId,
          event.altKey && event.shiftKey
            ? "up"
            : event.shiftKey
              ? "down"
              : event.altKey
                ? "left"
                : "right",
        );
      } else if (key === "f" && event.shiftKey && !event.altKey) {
        event.preventDefault();
        openSearch("all");
      } else if (key === "f" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openSearch("tab");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSession, activeSessionId, openSearch, splitSession, toggleSidebar, toggleTerminal]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-shell-main">
      <PanelHeader
        macosInset={!sidebarOpen}
        leading={
          <div className="window-title-bar-interactive flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("workspace.toggleSidebar")}
              title={t("workspace.toggleSidebar")}
              onClick={toggleSidebar}
            >
              <PanelLeftIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("nav.commandPalette")}
              title={t("nav.commandPalette")}
              onClick={() => openPalette()}
            >
              <SearchIcon />
            </Button>
            {workspace ? (
              <span className="ml-2 truncate text-xs text-muted-foreground">
                {workspace.source === "remote" ? "SSH · " : ""}{workspace.name}
              </span>
            ) : null}
          </div>
        }
        trailing={
          <div className="window-title-bar-interactive flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={terminalOpen ? t("workspace.hideTerminal") : t("workspace.showTerminal")}
              title={terminalOpen ? t("workspace.hideTerminal") : t("workspace.showTerminal")}
              onClick={toggleTerminal}
            >
              <PanelBottomIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("actions.settings")}
              title={t("actions.settings")}
              onClick={() => void openSettingsWindow()}
            >
              <SettingsIcon />
            </Button>
            {getPlatform() !== "macos" ? <WindowControls /> : null}
          </div>
        }
      />

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          id="workspace-main"
          orientation="vertical"
          defaultLayout={defaultLayout}
          onLayoutChanged={setLayout}
        >
          <ResizablePanel id="editor" defaultSize={600} minSize={120} className="min-h-0">
            <div className="flex h-full min-h-0 flex-col">
              {tabCount > 0 ? <WorkbenchTabArea /> : <EditorEmptyState />}
            </div>
          </ResizablePanel>
          {terminalOpen ? <ResizableHandle /> : null}
          {terminalOpen ? (
            <ResizablePanel id="terminal" defaultSize={280} minSize={120} collapsible className="min-h-0">
              <WorkspaceTerminal />
            </ResizablePanel>
          ) : null}
        </ResizablePanelGroup>
      </div>
      <WorkspaceStatusBar />
    </div>
  );
}

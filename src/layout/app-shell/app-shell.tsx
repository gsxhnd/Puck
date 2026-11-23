/**
 * Lightweight local/remote code workbench shell.
 *
 * 轻量级代码工作台外壳（孤岛模式）：顶部整宽标题岛、左侧 Workspace 导航岛、
 * 中央编辑器与终端岛、底部整宽状态条岛。保留命令面板、凭据确认和全局快捷键。
 */
import { useEffect, useMemo, useRef } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { AppHeader } from "@/layout/app-shell/app-header";
import { MainPanel } from "@/layout/app-shell/main-panel";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { WorkspaceStatusBar } from "@/components/workspace/workspace-status-bar";
import { RemoteWorkspaceConnection } from "@/components/workspace/remote-workspace-connection";
import { CommandPalette } from "@/components/command-palette";
import { CredentialPromptDialog } from "@/components/connections/credential-prompt-dialog";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { getPlatform } from "@/lib/platform";
import { createWorkspaceTerminal } from "@/lib/workspace-actions";
import { cn } from "@/lib/utils";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSessionStore } from "@/stores/session-store";
import { useSessionPrivilegesStore } from "@/stores/session-privileges-store";
import { useShellLayoutStore } from "@/stores/shell-layout-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const SIDEBAR_SIZE = { default: 248, min: 200, max: 380 } as const;

export function AppShell() {
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen);
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);
  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const setLayout = useShellLayoutStore((state) => state.setLayout);
  const horizontalLayout = useMemo(
    () => useShellLayoutStore.getState().getHorizontalLayout(),
    [],
  );
  const openPalette = useCommandPaletteStore((state) => state.openPalette);
  const openTerminalOnStart = useAppSettingsStore(
    (state) => state.openLocalTerminalOnStart,
  );
  const sessions = useSessionStore((state) => state.sessions);
  const prunePrivileges = useSessionPrivilegesStore((state) => state.pruneSessions);
  const startupTerminalRef = useRef(false);

  useEffect(() => {
    prunePrivileges(sessions.map((session) => session.id));
  }, [prunePrivileges, sessions]);

  useEffect(() => {
    if (!openTerminalOnStart || startupTerminalRef.current) return;
    startupTerminalRef.current = true;
    const workspaceState = useWorkspaceStore.getState();
    if (!workspaceState.activeWorkspace) {
      workspaceState.openLocalWorkspace("~");
    }
    void createWorkspaceTerminal();
  }, [openTerminalOnStart]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === ",") {
        event.preventDefault();
        void openSettingsWindow();
      } else if (key === "p" && event.shiftKey) {
        event.preventDefault();
        openPalette();
      } else if (key === "l" && event.shiftKey) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    const onOpenPalette = () => openPalette();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("puck:command-palette", onOpenPalette);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("puck:command-palette", onOpenPalette);
    };
  }, [openPalette, toggleSidebar]);

  // Keep the panel's collapsed/expanded geometry in sync with sidebarOpen so
  // dragging the handle past the min size behaves like the header toggle.
  // 通过 onResize 同步面板折叠状态与 sidebarOpen，拖拽收起与头部开关行为一致。
  useEffect(() => {
    if (sidebarOpen) sidebarRef.current?.expand();
    else sidebarRef.current?.collapse();
  }, [sidebarOpen]);

  return (
    <div
      data-app-shell
      data-shell="main"
      data-platform={getPlatform()}
      data-primary-panel-open={sidebarOpen ? "true" : "false"}
      // The header and status bar blend into the shell base (hairline
      // separators only), so the window reads as one connected surface; the
      // island look stays inside the content area.
      // header 与状态栏融入底色（仅细分隔线），窗口呈连续表面；孤岛样式只保留
      // 在内容区内部。
      className="flex h-svh flex-col overflow-hidden bg-shell-secondary"
    >
      <AppHeader />

      <div className="min-h-0 flex-1 px-2 py-2">
        <ResizablePanelGroup
          id="app-shell"
          orientation="horizontal"
          // The gap only applies while the sidebar is open; a collapsed panel
          // stays mounted at zero width and must not leave phantom space.
          // 侧栏展开时才有间隙；折叠面板仍挂载为 0 宽，不能留下幻影空隙。
          className={cn("h-full", sidebarOpen && "gap-2")}
          defaultLayout={horizontalLayout}
          onLayoutChanged={setLayout}
        >
          <ResizablePanel
            id="primary"
            panelRef={sidebarRef}
            defaultSize={SIDEBAR_SIZE.default}
            minSize={SIDEBAR_SIZE.min}
            maxSize={SIDEBAR_SIZE.max}
            collapsible
            collapsedSize={0}
            className="min-w-0"
            onResize={(size, _id, previous) => {
              // Only react to real collapse/expand transitions, never to the
              // initial layout measurement.
              // 只在真实的折叠/展开过渡时同步；初始布局测量（previous 为空）忽略。
              if (!previous) return;
              const collapsed = size.inPixels <= 1;
              const wasCollapsed = previous.inPixels <= 1;
              if (collapsed === wasCollapsed) return;
              const state = useWorkspaceStore.getState();
              if (collapsed && state.sidebarOpen) state.setSidebarOpen(false);
              else if (!collapsed && !state.sidebarOpen) {
                state.setSidebarOpen(true);
              }
            }}
          >
            {sidebarOpen ? (
              <div className="island h-full bg-shell-primary">
                <WorkspaceSidebar />
              </div>
            ) : null}
          </ResizablePanel>
          {sidebarOpen ? <ResizableHandle /> : null}
          <ResizablePanel id="main" minSize={480} className="min-w-0">
            <MainPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <WorkspaceStatusBar />

      <RemoteWorkspaceConnection />
      <CommandPalette />
      <CredentialPromptDialog />
    </div>
  );
}

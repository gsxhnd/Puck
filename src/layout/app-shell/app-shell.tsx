/**
 * Lightweight local/remote code workbench shell.
 *
 * 轻量级代码工作台外壳：左侧 Workspace 导航，中央编辑器与终端，底部状态栏。
 * 保留命令面板、凭据确认和全局快捷键，不再使用 Sessions 三栏布局。
 */
import { useEffect, useMemo, useRef } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { MainPanel } from "@/layout/app-shell/main-panel";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { RemoteWorkspaceConnection } from "@/components/workspace/remote-workspace-connection";
import { CommandPalette } from "@/components/command-palette";
import { CredentialPromptDialog } from "@/components/connections/credential-prompt-dialog";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { getPlatform } from "@/lib/platform";
import { createWorkspaceTerminal } from "@/lib/workspace-actions";
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

const SIDEBAR_SIZE = { default: 264, min: 210, max: 420 } as const;

export function AppShell() {
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen);
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);
  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const setLayout = useShellLayoutStore((state) => state.setLayout);
  const defaultLayout = useMemo(
    () => useShellLayoutStore.getState().getDefaultLayout(),
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
      className="h-svh overflow-hidden"
    >
      <ResizablePanelGroup
        id="app-shell"
        orientation="horizontal"
        className="h-full"
        defaultLayout={defaultLayout}
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
          className="min-w-0 overflow-hidden"
        >
          <WorkspaceSidebar />
        </ResizablePanel>
        {sidebarOpen ? <ResizableHandle /> : null}
        <ResizablePanel id="main" minSize={480} className="min-w-0">
          <MainPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
      <RemoteWorkspaceConnection />
      <CommandPalette />
      <CredentialPromptDialog />
    </div>
  );
}

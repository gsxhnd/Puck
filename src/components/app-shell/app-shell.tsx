import { useEffect, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ConnectionSidebar } from "@/components/app-shell/connection-sidebar";
import { MainWorkspace } from "@/components/app-shell/main-workspace";
import { SecondarySidebar } from "@/components/app-shell/secondary-sidebar";
import { WindowTitleBar } from "@/components/app-shell/window-title-bar";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { getPlatform } from "@/lib/platform";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useSessionStore } from "@/stores/session-store";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarProvider } from "@/components/ui/sidebar";

const SHELL_LAYOUT_KEY = "puck-shell-layout";

/** Sidebar width constraints (px), aligned with shadcn default 16rem ≈ 256px */
const SHELL_PANEL_SIZES = {
  left: { default: 256, min: 200, max: 360 },
  right: { default: 300, min: 240, max: 450 },
  main: { min: 480 },
} as const;

function readStoredLayout(): Record<string, number> | undefined {
  try {
    const raw = localStorage.getItem(SHELL_LAYOUT_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return undefined;
  }
}

export function AppShell() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const leftPanelRef = useRef<PanelImperativeHandle>(null);
  const rightPanelRef = useRef<PanelImperativeHandle>(null);
  const openLocalOnStart = useAppSettingsStore(
    (state) => state.openLocalTerminalOnStart,
  );
  const sessions = useSessionStore((state) => state.sessions);
  const addSession = useSessionStore((state) => state.addSession);

  useEffect(() => {
    if (!openLocalOnStart || sessions.length > 0) return;
    addSession({
      kind: "terminal",
      title: "__local__",
      protocol: "local",
    });
  }, [addSession, openLocalOnStart, sessions.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== ",") return;
      event.preventDefault();
      void openSettingsWindow();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (leftSidebarOpen) {
      leftPanelRef.current?.expand();
    } else {
      leftPanelRef.current?.collapse();
    }
  }, [leftSidebarOpen]);

  useEffect(() => {
    if (rightSidebarOpen) {
      rightPanelRef.current?.expand();
    } else {
      rightPanelRef.current?.collapse();
    }
  }, [rightSidebarOpen]);

  return (
    <div
      data-app-shell
      data-shell="main"
      data-platform={getPlatform()}
      className="flex h-svh flex-col overflow-hidden"
    >
      <WindowTitleBar
        leftSidebarOpen={leftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        onToggleLeftSidebar={() => setLeftSidebarOpen((v) => !v)}
        onToggleRightSidebar={() => setRightSidebarOpen((v) => !v)}
      />
      <SidebarProvider
        open={leftSidebarOpen}
        onOpenChange={setLeftSidebarOpen}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ResizablePanelGroup
          id="app-shell"
          orientation="horizontal"
          className="min-h-0 flex-1"
          defaultLayout={
            readStoredLayout() ?? { left: 20, main: 55, right: 25 }
          }
          onLayoutChanged={(layout) => {
            try {
              localStorage.setItem(SHELL_LAYOUT_KEY, JSON.stringify(layout));
            } catch {
              // Ignore quota or private browsing errors.
            }

            const leftSize = layout.left ?? 0;
            const rightSize = layout.right ?? 0;

            if (leftSize === 0 && leftSidebarOpen) {
              setLeftSidebarOpen(false);
            } else if (leftSize > 0 && !leftSidebarOpen) {
              setLeftSidebarOpen(true);
            }

            if (rightSize === 0 && rightSidebarOpen) {
              setRightSidebarOpen(false);
            } else if (rightSize > 0 && !rightSidebarOpen) {
              setRightSidebarOpen(true);
            }
          }}
        >
          <ResizablePanel
            id="left"
            panelRef={leftPanelRef}
            defaultSize={SHELL_PANEL_SIZES.left.default}
            minSize={SHELL_PANEL_SIZES.left.min}
            maxSize={SHELL_PANEL_SIZES.left.max}
            collapsible
            collapsedSize={0}
            className="min-w-0"
          >
            <ConnectionSidebar />
          </ResizablePanel>
          {leftSidebarOpen ? <ResizableHandle withHandle /> : null}
          <ResizablePanel id="main" minSize={SHELL_PANEL_SIZES.main.min}>
            <div className="h-full min-h-0 overflow-hidden bg-background">
              <MainWorkspace />
            </div>
          </ResizablePanel>
          {rightSidebarOpen ? <ResizableHandle withHandle /> : null}
          <ResizablePanel
            id="right"
            panelRef={rightPanelRef}
            defaultSize={SHELL_PANEL_SIZES.right.default}
            minSize={SHELL_PANEL_SIZES.right.min}
            maxSize={SHELL_PANEL_SIZES.right.max}
            collapsible
            collapsedSize={0}
            className="min-w-0"
          >
            <SecondarySidebar />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarProvider>
    </div>
  );
}

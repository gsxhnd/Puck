import { useEffect, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { PrimaryPanel } from "@/layout/app-shell/primary-panel";
import { MainPanel } from "@/layout/app-shell/main-panel";
import { SecondPanel } from "@/layout/app-shell/second-panel";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { getPlatform } from "@/lib/platform";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useSessionStore } from "@/stores/session-store";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const SHELL_LAYOUT_KEY = "puck-shell-layout";

/** Panel width constraints (px), aligned with shadcn default 16rem ≈ 256px */
const SHELL_PANEL_SIZES = {
  primary: { default: 256, min: 200, max: 360 },
  second: { default: 300, min: 240, max: 450 },
  main: { min: 480 },
} as const;

function migrateStoredLayout(
  layout: Record<string, number>,
): Record<string, number> {
  const { left, right, primary, second, main, ...rest } = layout;
  return {
    ...rest,
    primary: primary ?? left,
    main,
    second: second ?? right,
  };
}

function readStoredLayout(): Record<string, number> | undefined {
  try {
    const raw = localStorage.getItem(SHELL_LAYOUT_KEY);
    if (!raw) return undefined;
    return migrateStoredLayout(JSON.parse(raw) as Record<string, number>);
  } catch {
    return undefined;
  }
}

export function AppShell() {
  const [primaryPanelOpen, setPrimaryPanelOpen] = useState(true);
  const [secondPanelOpen, setSecondPanelOpen] = useState(true);
  const primaryPanelRef = useRef<PanelImperativeHandle>(null);
  const secondPanelRef = useRef<PanelImperativeHandle>(null);
  const openLocalOnStart = useAppSettingsStore(
    (state) => state.openLocalTerminalOnStart,
  );
  const addSession = useSessionStore((state) => state.addSession);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    if (!openLocalOnStart) return;
    addSession({
      kind: "terminal",
      title: "__local__",
      protocol: "local",
    });
  }, [addSession, openLocalOnStart]);

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
    if (primaryPanelOpen) {
      primaryPanelRef.current?.expand();
    } else {
      primaryPanelRef.current?.collapse();
    }
  }, [primaryPanelOpen]);

  useEffect(() => {
    if (secondPanelOpen) {
      secondPanelRef.current?.expand();
    } else {
      secondPanelRef.current?.collapse();
    }
  }, [secondPanelOpen]);

  return (
    <div
      data-app-shell
      data-shell="main"
      data-platform={getPlatform()}
      className="h-svh overflow-hidden"
    >
      <ResizablePanelGroup
        id="app-shell"
        orientation="horizontal"
        className="h-full"
        defaultLayout={
          readStoredLayout() ?? { primary: 20, main: 55, second: 25 }
        }
        onLayoutChanged={(layout) => {
          try {
            localStorage.setItem(
              SHELL_LAYOUT_KEY,
              JSON.stringify(migrateStoredLayout(layout)),
            );
          } catch {
            // Ignore quota or private browsing errors.
          }

          const primarySize = layout.primary ?? layout.left ?? 0;
          const secondSize = layout.second ?? layout.right ?? 0;

          if (primarySize === 0 && primaryPanelOpen) {
            setPrimaryPanelOpen(false);
          } else if (primarySize > 0 && !primaryPanelOpen) {
            setPrimaryPanelOpen(true);
          }

          if (secondSize === 0 && secondPanelOpen) {
            setSecondPanelOpen(false);
          } else if (secondSize > 0 && !secondPanelOpen) {
            setSecondPanelOpen(true);
          }
        }}
      >
        <ResizablePanel
          id="primary"
          panelRef={primaryPanelRef}
          defaultSize={SHELL_PANEL_SIZES.primary.default}
          minSize={SHELL_PANEL_SIZES.primary.min}
          maxSize={SHELL_PANEL_SIZES.primary.max}
          collapsible
          collapsedSize={0}
          className="min-w-0 overflow-hidden"
        >
          <PrimaryPanel
            collapsed={!primaryPanelOpen}
            onToggleCollapsed={() => setPrimaryPanelOpen((open) => !open)}
          />
        </ResizablePanel>
        {primaryPanelOpen ? <ResizableHandle /> : null}
        <ResizablePanel id="main" minSize={SHELL_PANEL_SIZES.main.min}>
          <MainPanel
            primaryPanelOpen={primaryPanelOpen}
            secondPanelOpen={secondPanelOpen}
            onToggleSecondPanel={() => setSecondPanelOpen((open) => !open)}
          />
        </ResizablePanel>
        {secondPanelOpen ? <ResizableHandle /> : null}
        <ResizablePanel
          id="second"
          panelRef={secondPanelRef}
          defaultSize={SHELL_PANEL_SIZES.second.default}
          minSize={SHELL_PANEL_SIZES.second.min}
          maxSize={SHELL_PANEL_SIZES.second.max}
          collapsible
          collapsedSize={0}
          className="min-w-0 overflow-hidden"
        >
          <SecondPanel
            secondPanelOpen={secondPanelOpen}
            onToggleSecondPanel={() => setSecondPanelOpen((open) => !open)}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

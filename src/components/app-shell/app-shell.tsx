import { useEffect, useState } from "react";
import { ConnectionSidebar } from "@/components/app-shell/connection-sidebar";
import { MainWorkspace } from "@/components/app-shell/main-workspace";
import { WindowTitleBar } from "@/components/app-shell/window-title-bar";
import { TransferQueue } from "@/components/files/transfer-queue";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { getPlatform } from "@/lib/platform";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useSessionStore } from "@/stores/session-store";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function AppShell() {
  const [transferQueueOpen, setTransferQueueOpen] = useState(false);
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

  return (
    <div
      data-app-shell
      data-platform={getPlatform()}
      className="flex h-svh flex-col overflow-hidden"
    >
      <WindowTitleBar />
      <SidebarProvider className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ConnectionSidebar />
          <SidebarInset className="min-h-0 overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">
              <MainWorkspace />
            </div>
            <TransferQueue
              open={transferQueueOpen}
              onOpenChange={setTransferQueueOpen}
            />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

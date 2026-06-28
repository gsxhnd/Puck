import { ConnectionsPage } from "@/page/connections/connections-page";
import { WindowTitleBar } from "@/layout/app-shell/window-title-bar";
import { getPlatform } from "@/lib/platform";

export function ConnectionsShell() {
  return (
    <div
      data-app-shell
      data-shell="connections"
      data-platform={getPlatform()}
      className="flex h-svh flex-col overflow-hidden bg-background"
    >
      <WindowTitleBar titleKey="connections:manager.title" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <ConnectionsPage />
      </div>
    </div>
  );
}

import { SettingsPage } from "@/components/settings/settings-page";
import { WindowTitleBar } from "@/components/app-shell/window-title-bar";
import { getPlatform } from "@/lib/platform";

export function SettingsShell() {
  return (
    <div
      data-app-shell
      data-platform={getPlatform()}
      className="flex h-svh flex-col overflow-hidden bg-background"
    >
      <WindowTitleBar />
      <div className="min-h-0 flex-1 overflow-hidden">
        <SettingsPage />
      </div>
    </div>
  );
}

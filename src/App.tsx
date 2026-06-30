import { AppShell } from "@/layout/app-shell/app-shell";
import { AppProviders } from "@/layout/providers/app-providers";
import { ConnectionBridgeListener } from "@/layout/providers/connection-bridge-listener";
import { SessionStatusListener } from "@/layout/providers/session-status-listener";
import { ConnectionSync } from "@/layout/providers/connection-sync";
import { AuxiliaryWindowSync } from "@/layout/providers/auxiliary-window-sync";
import { MacMenuListener } from "@/layout/providers/mac-menu-listener";
import { MacWindowChrome } from "@/layout/providers/mac-window-chrome";
import { SettingsSync } from "@/layout/providers/settings-sync";
import { ThemeSync } from "@/layout/providers/theme-sync";
import { ConnectionsShell } from "@/layout/connections-shell";
import { EditorShell } from "@/layout/editor-shell";
import { SettingsShell } from "@/layout/settings-shell";
import { getAppWindowMode } from "@/lib/app-window";
import "./App.css";

function App() {
  const mode = getAppWindowMode();

  return (
    <AppProviders>
      <ThemeSync />
      <SettingsSync />
      <ConnectionSync />
      <AuxiliaryWindowSync />
      <MacWindowChrome />
      <MacMenuListener />
      <ConnectionBridgeListener />
      <SessionStatusListener />
      {mode === "settings" ? (
        <SettingsShell />
      ) : mode === "connections" ? (
        <ConnectionsShell />
      ) : mode === "editor" ? (
        <EditorShell />
      ) : (
        <AppShell />
      )}
    </AppProviders>
  );
}

export default App;

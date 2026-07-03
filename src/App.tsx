import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/layout/app-shell/app-shell";
import { AppProviders } from "@/layout/providers/app-providers";
import { ConnectionBridgeListener } from "@/layout/providers/connection-bridge-listener";
import { SessionStatusListener } from "@/layout/providers/session-status-listener";
import { ConnectionSync } from "@/layout/providers/connection-sync";
import { AuxiliaryWindowSync } from "@/layout/providers/auxiliary-window-sync";
import { AppMenuListener } from "@/layout/providers/app-menu-listener";
import { MacWindowChrome } from "@/layout/providers/mac-window-chrome";
import { SettingsSync } from "@/layout/providers/settings-sync";
import { ThemeSync } from "@/layout/providers/theme-sync";
import { ConnectionsShell } from "@/layout/connections-shell";
import { SettingsShell } from "@/layout/settings-shell";
import { getAppWindowMode } from "@/lib/app-window";
import "./App.css";

const EditorShell = lazy(() =>
  import("@/layout/editor-shell").then((module) => ({
    default: module.EditorShell,
  })),
);

function EditorShellFallback() {
  const { t } = useTranslation("editor");
  return (
    <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      {t("shellLoading")}
    </div>
  );
}

function App() {
  const mode = getAppWindowMode();

  return (
    <AppProviders>
      <ThemeSync />
      <SettingsSync />
      <ConnectionSync />
      <AuxiliaryWindowSync />
      <MacWindowChrome />
      <AppMenuListener />
      <ConnectionBridgeListener />
      <SessionStatusListener />
      {mode === "settings" ? (
        <SettingsShell />
      ) : mode === "connections" ? (
        <ConnectionsShell />
      ) : mode === "editor" ? (
        <Suspense fallback={<EditorShellFallback />}>
          <EditorShell />
        </Suspense>
      ) : (
        <AppShell />
      )}
    </AppProviders>
  );
}

export default App;

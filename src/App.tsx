import { AppShell } from "@/layout/app-shell/app-shell";
import { AppProviders } from "@/layout/providers/app-providers";
import { MacWindowChrome } from "@/layout/providers/mac-window-chrome";
import { SettingsSync } from "@/layout/providers/settings-sync";
import { ThemeSync } from "@/layout/providers/theme-sync";
import { SettingsShell } from "@/layout/settings-shell";
import { getAppWindowMode } from "@/lib/app-window";
import "./App.css";

function App() {
  const mode = getAppWindowMode();

  return (
    <AppProviders>
      <ThemeSync />
      <SettingsSync />
      <MacWindowChrome />
      {mode === "settings" ? <SettingsShell /> : <AppShell />}
    </AppProviders>
  );
}

export default App;

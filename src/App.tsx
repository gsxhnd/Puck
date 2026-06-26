import { AppShell } from "@/components/app-shell/app-shell";
import { AppProviders } from "@/components/providers/app-providers";
import { MacWindowChrome } from "@/components/providers/mac-window-chrome";
import { SettingsSync } from "@/components/providers/settings-sync";
import { ThemeSync } from "@/components/providers/theme-sync";
import { SettingsShell } from "@/components/settings/settings-shell";
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

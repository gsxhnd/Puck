import { AppShell } from "@/components/app-shell/app-shell";
import { AppProviders } from "@/components/providers/app-providers";
import { ThemeSync } from "@/components/providers/theme-sync";
import "./App.css";

function App() {
  return (
    <AppProviders>
      <ThemeSync />
      <AppShell />
    </AppProviders>
  );
}

export default App;

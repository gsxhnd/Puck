import { useTranslation } from "react-i18next";
import { WindowControls } from "@/layout/app-shell/window-controls";
import { PanelHeader } from "@/layout/app-shell/panel-header";
import { getPlatform } from "@/lib/platform";

/** Title bar for standalone windows (e.g. settings) that use a single full-width header. */
export function WindowTitleBar({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  const platform = getPlatform();

  return (
    <PanelHeader
      macosInset
      leading={
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">
          {t(titleKey)}
        </span>
      }
      trailing={platform !== "macos" ? <WindowControls /> : null}
    />
  );
}

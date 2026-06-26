import { useTranslation } from "react-i18next";
import { WindowControls } from "@/layout/app-shell/window-controls";
import { PanelHeader } from "@/layout/app-shell/panel-header";
import { getPlatform } from "@/lib/platform";

/** Title bar for standalone windows (e.g. settings) that use a single full-width header. */
export function WindowTitleBar() {
  const { t } = useTranslation("common");
  const platform = getPlatform();

  return (
    <PanelHeader
      macosInset
      leading={
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">
          {t("actions.settings")}
        </span>
      }
      trailing={platform !== "macos" ? <WindowControls /> : null}
    />
  );
}

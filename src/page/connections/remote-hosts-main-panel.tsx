import { useTranslation } from "react-i18next";
import { ServerIcon } from "lucide-react";
import { useShellUiStore } from "@/stores/shell-ui-store";
import { ConnectionProfilePanel } from "@/page/connections/connection-profile-panel";
import { Button } from "@/components/ui/button";

function RemoteHostsHome() {
  const { t } = useTranslation(["connections", "common"]);
  const openHostEditor = useShellUiStore((state) => state.openHostEditor);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <ServerIcon className="size-6" />
      </div>
      <div className="max-w-sm space-y-1">
        <h2 className="text-lg font-medium">{t("connections:manager.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("connections:primaryPanel.hostsHome")}
        </p>
      </div>
      <Button size="sm" onClick={() => openHostEditor(null)}>
        {t("common:actions.newConnection")}
      </Button>
    </div>
  );
}

export function RemoteHostsMainPanel() {
  const hostEditorOpen = useShellUiStore((state) => state.hostEditorOpen);
  const selectedProfileId = useShellUiStore((state) => state.selectedProfileId);

  if (hostEditorOpen) {
    return <ConnectionProfilePanel profileId={selectedProfileId} />;
  }

  return <RemoteHostsHome />;
}

import { useTranslation } from "react-i18next";
import { TransferQueueContent } from "@/components/files/transfer-queue";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";

export function SecondarySidebar() {
  const { t } = useTranslation(["common"]);

  return (
    <Sidebar side="right" collapsible="none" className="h-full w-full border-l">
      <SidebarHeader className="px-4 py-3">
        <p className="text-sm font-semibold">
          {t("common:nav.transferQueue")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("common:nav.secondaryPanel")}
        </p>
      </SidebarHeader>
      <SidebarContent className="flex flex-col">
        <TransferQueueContent />
      </SidebarContent>
    </Sidebar>
  );
}

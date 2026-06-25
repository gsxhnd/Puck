import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CommandIcon, PanelLeftIcon, UploadIcon } from "lucide-react";
import { ConnectionSidebar } from "@/components/app-shell/connection-sidebar";
import { MainWorkspace } from "@/components/app-shell/main-workspace";
import { SessionTabs } from "@/components/app-shell/session-tabs";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useSessionStore } from "@/stores/session-store";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppShell() {
  const { t } = useTranslation("common");
  const openLocalOnStart = useAppSettingsStore(
    (state) => state.openLocalTerminalOnStart,
  );
  const sessions = useSessionStore((state) => state.sessions);
  const addSession = useSessionStore((state) => state.addSession);

  useEffect(() => {
    if (!openLocalOnStart || sessions.length > 0) return;
    addSession({
      kind: "terminal",
      title: "__local__",
      protocol: "local",
    });
  }, [addSession, openLocalOnStart, sessions.length]);

  return (
    <SidebarProvider>
      <ConnectionSidebar />
      <SidebarInset className="min-h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Tooltip>
            <TooltipTrigger
              render={
                <SidebarTrigger
                  className="-ml-1"
                  aria-label={t("nav.connections")}
                />
              }
            />
            <TooltipContent>{t("nav.connections")}</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <PanelLeftIcon className="size-4 text-muted-foreground" />
            <span className="truncate text-sm font-medium">
              {t("app.name")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("nav.transferQueue")}
                  >
                    <UploadIcon />
                  </Button>
                }
              />
              <TooltipContent>{t("nav.transferQueue")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("nav.commandPalette")}
                  >
                    <CommandIcon />
                  </Button>
                }
              />
              <TooltipContent>{t("nav.commandPalette")}</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <SessionTabs />
        <main className="min-h-0 flex-1 overflow-hidden">
          <MainWorkspace />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

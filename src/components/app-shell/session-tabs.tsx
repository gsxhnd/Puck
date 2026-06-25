import { useTranslation } from "react-i18next";
import { PlusIcon, SettingsIcon, XIcon } from "lucide-react";
import { useSessionStore } from "@/stores/session-store";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SessionTabs() {
  const { t } = useTranslation(["common", "terminal", "settings"]);
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const closeSession = useSessionStore((state) => state.closeSession);
  const addSession = useSessionStore((state) => state.addSession);
  const openSettings = useSessionStore((state) => state.openSettings);

  const resolveTitle = (session: (typeof sessions)[number]) => {
    if (session.kind === "settings") return t("settings:title");
    if (
      session.title === "__local__" ||
      session.title === "Local Terminal" ||
      session.title === "本地终端"
    ) {
      return t("terminal:localDefault");
    }
    return session.title;
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-background px-2">
      <ScrollArea className="max-w-[calc(100%-5rem)] whitespace-nowrap">
        <div className="flex items-center gap-1 pr-2">
          {sessions.length === 0 ? (
            <span className="px-2 text-xs text-muted-foreground">
              {t("common:empty.noSessions")}
            </span>
          ) : (
            sessions.map((session) => {
              const active = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group inline-flex h-8 max-w-56 items-center rounded-md border text-sm transition-colors",
                    active
                      ? "border-border bg-muted text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate px-3 py-1 text-left"
                    onClick={() => setActiveSession(session.id)}
                  >
                    {resolveTitle(session)}
                  </button>
                  <button
                    type="button"
                    className="mr-1 inline-flex size-6 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-background/80"
                    aria-label={t("common:actions.close")}
                    onClick={() => closeSession(session.id)}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("common:actions.newTerminal")}
                onClick={() =>
                  addSession({
                    kind: "terminal",
                    title: "__local__",
                    protocol: "local",
                  })
                }
              >
                <PlusIcon />
              </Button>
            }
          />
          <TooltipContent>{t("common:actions.newTerminal")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("common:actions.settings")}
                onClick={openSettings}
              >
                <SettingsIcon />
              </Button>
            }
          />
          <TooltipContent>{t("common:actions.settings")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import { useSessionStore } from "@/stores/session-store";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function SessionTabStrip() {
  const { t } = useTranslation(["common", "terminal"]);
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const closeSession = useSessionStore((state) => state.closeSession);

  const resolveTitle = (session: (typeof sessions)[number]) => {
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
    <ScrollArea className="min-w-0 flex-1 whitespace-nowrap">
      <div className="flex items-center gap-1 px-1">
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
                  "group inline-flex h-7 max-w-56 shrink-0 items-center rounded-md border text-sm transition-colors",
                  active
                    ? "border-border bg-muted text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate px-2.5 py-1 text-left"
                  onClick={() => setActiveSession(session.id)}
                >
                  {resolveTitle(session)}
                </button>
                <button
                  type="button"
                  className="mr-0.5 inline-flex size-5 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-background/80"
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
  );
}

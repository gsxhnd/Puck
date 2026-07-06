import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import { useSessionStore } from "@/stores/session-store";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTerminalSplitStore } from "@/stores/terminal-split-store";
import {
  closeSplitTab,
  filterTabVisibleSessions,
  isSessionInSplitLayout,
  isSplitTabActive,
} from "@/lib/terminal-split-sessions";

import { cn } from "@/lib/utils";

export function SessionTabStrip() {
  const { t } = useTranslation(["common", "terminal"]);
  const sessions = useSessionStore((state) => state.sessions);
  const splitLayout = useTerminalSplitStore((state) => state.layout);
  const tabSessions = filterTabVisibleSessions(sessions, splitLayout);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

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
        {tabSessions.length === 0 ? (
          <span className="px-2 text-xs text-muted-foreground">
            {t("common:empty.noSessions")}
          </span>
        ) : (
          tabSessions.map((session) => {
            const active = isSplitTabActive(
              session.id,
              activeSessionId,
              splitLayout,
            );
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
                  onClick={() => {
                    if (
                      splitLayout &&
                      (session.id === splitLayout.tabSessionId ||
                        isSessionInSplitLayout(session.id, splitLayout))
                    ) {
                      closeSplitTab(splitLayout.tabSessionId);
                      return;
                    }
                    useSessionStore.getState().closeSession(session.id);
                  }}
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

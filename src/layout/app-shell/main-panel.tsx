import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PanelRightIcon } from "lucide-react";
import { PanelHeader } from "@/layout/app-shell/panel-header";
import { MAIN_PANEL_TOOLBAR_SLOT_ID } from "@/layout/app-shell/main-panel-toolbar-slot";
import { useSessionStore } from "@/stores/session-store";
import { NewTerminalMenu } from "@/page/terminal/new-terminal-menu";
import { TerminalPathBar } from "@/page/terminal/terminal-path-bar";
import { TerminalWorkspace } from "@/page/terminal/terminal-workspace";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";
import { useTerminalSplitStore } from "@/stores/terminal-split-store";
import type { TerminalSplitDirection } from "@/types/terminal-split";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MainPanelProps = {
  primaryPanelOpen?: boolean;
  secondPanelOpen?: boolean;
  onToggleSecondPanel?: () => void;
};

function EmptyMainPanel() {
  const { t } = useTranslation(["common", "terminal"]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("common:app.name")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("common:empty.noSessions")}
        </p>
      </div>
      <NewTerminalMenu />
    </div>
  );
}

function MainPanelHeader({
  primaryPanelOpen = true,
  secondPanelOpen = true,
  onToggleSecondPanel,
}: MainPanelProps) {
  const { t } = useTranslation("common");
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  return (
    <PanelHeader
      layout="balanced"
      macosInset={!primaryPanelOpen}
      leading={
        <div
          id={MAIN_PANEL_TOOLBAR_SLOT_ID}
          className="flex min-h-7 items-center gap-0.5"
        />
      }
      center={
        activeSession?.kind === "terminal" ? (
          <TerminalPathBar session={activeSession} />
        ) : null
      }
      trailing={
        !secondPanelOpen && onToggleSecondPanel ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    !secondPanelOpen && "text-muted-foreground",
                  )}
                  aria-label={t("nav.toggleSecondPanel")}
                  onClick={onToggleSecondPanel}
                >
                  <PanelRightIcon />
                </Button>
              }
            />
            <TooltipContent side="bottom">
              {t("nav.toggleSecondPanel")}
            </TooltipContent>
          </Tooltip>
        ) : null
      }
    />
  );
}

export function MainPanel({
  primaryPanelOpen,
  secondPanelOpen,
  onToggleSecondPanel,
}: MainPanelProps) {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const openSearch = useTerminalSearchStore((state) => state.openSearch);
  const splitSession = useTerminalSplitStore((state) => state.splitSession);
  const syncSplit = useTerminalSplitStore((state) => state.syncWithSessions);

  useEffect(() => {
    syncSplit(sessions.map((session) => session.id));
  }, [sessions, syncSplit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || activeSession?.kind !== "terminal") {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "d") {
        event.preventDefault();
        if (!activeSessionId) return;
        const direction: TerminalSplitDirection = event.altKey && event.shiftKey
          ? "up"
          : event.shiftKey
            ? "down"
            : event.altKey
              ? "left"
              : "right";
        splitSession(activeSessionId, direction);
        return;
      }

      if (key === "f" && event.shiftKey && !event.altKey) {
        event.preventDefault();
        openSearch("all");
        return;
      }

      if (key === "f" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openSearch("tab");
        return;
      }

      if (key === "j") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("puck:focus-outline"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSession?.kind, activeSessionId, openSearch, splitSession]);

  if (!activeSession) {
    return (
      <div className="main-panel-root flex h-full min-h-0 flex-col overflow-hidden bg-shell-main">
        <MainPanelHeader
          primaryPanelOpen={primaryPanelOpen}
          secondPanelOpen={secondPanelOpen}
          onToggleSecondPanel={onToggleSecondPanel}
        />
        <EmptyMainPanel />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-shell-main">
      <MainPanelHeader
        primaryPanelOpen={primaryPanelOpen}
        secondPanelOpen={secondPanelOpen}
        onToggleSecondPanel={onToggleSecondPanel}
      />
      <TerminalWorkspace activeSessionId={activeSessionId} />
    </div>
  );
}

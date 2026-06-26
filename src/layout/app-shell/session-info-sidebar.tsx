import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  CopyIcon,
  FolderOpenIcon,
  InfoIcon,
  ListIcon,
  PanelRightIcon,
} from "lucide-react";
import { TransferQueueContent } from "@/components/files/transfer-queue";
import { useSessionStore } from "@/stores/session-store";
import { getSessionPathDisplay, getShellBadge } from "@/lib/session-display";
import { isTauri } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PanelHeader } from "@/layout/app-shell/panel-header";
import { WindowControls } from "@/layout/app-shell/window-controls";
import { getPlatform } from "@/lib/platform";

type PanelView = "info" | "transfers";

function formatElapsed(createdAt: string): string {
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function InfoAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      <Icon className="size-3.5 shrink-0 opacity-70" />
      <span>{label}</span>
    </button>
  );
}

function SessionInfoPanel() {
  const { t } = useTranslation("info");
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  const path = activeSession ? getSessionPathDisplay(activeSession) : null;
  const shell = activeSession ? getShellBadge(activeSession) : null;
  const elapsed = activeSession ? formatElapsed(activeSession.createdAt) : null;

  const copyPath = async () => {
    if (!path) return;
    await navigator.clipboard.writeText(path);
  };

  const revealPath = async () => {
    const target = activeSession?.cwd;
    if (!target || !isTauri()) return;
    try {
      await revealItemInDir(target);
    } catch {
      // Ignore reveal failures for remote or unresolved paths.
    }
  };

  if (!activeSession || activeSession.kind !== "terminal") {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        {t("noActiveTerminal")}
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-5 px-3 py-3">
        <section className="space-y-2">
          <h3 className="px-2 text-xs font-medium text-muted-foreground">
            {t("workingDirectory")}
          </h3>
          <p className="px-2 font-mono text-xs break-all text-foreground/90">
            {path}
          </p>
          <div className="space-y-0.5">
            <InfoAction
              icon={CopyIcon}
              label={t("copyPath")}
              onClick={() => void copyPath()}
            />
            <InfoAction
              icon={FolderOpenIcon}
              label={t("revealInFinder")}
              onClick={() => void revealPath()}
            />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="px-2 text-xs font-medium text-muted-foreground">
            {t("process")}
          </h3>
          <div className="space-y-1 px-2 font-mono text-xs text-foreground/90">
            <p>-{shell}</p>
            <p className="text-muted-foreground">{elapsed}</p>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="px-2 text-xs font-medium text-muted-foreground">
            {t("ports")}
          </h3>
          <p className="px-2 text-xs text-muted-foreground">
            {t("noListeningPorts")}
          </p>
        </section>
      </div>
    </ScrollArea>
  );
}

export function SessionInfoSidebar({
  rightSidebarOpen = true,
  onToggleRightSidebar,
}: {
  rightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
}) {
  const { t } = useTranslation(["info", "common"]);
  const [view, setView] = useState<PanelView>("info");

  const headerActions = useMemo(
    () =>
      [
        { id: "info" as const, icon: InfoIcon, label: t("info:title") },
        { id: "transfers" as const, icon: ListIcon, label: t("info:transfers") },
      ] as const,
    [t],
  );

  return (
    <div className="flex h-full w-full flex-col bg-shell-secondary">
      <PanelHeader
        leading={
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">
            {view === "info" ? t("info:title") : t("info:transfers")}
          </span>
        }
        trailing={
          <>
            {headerActions.map((action) => (
              <Button
                key={action.id}
                variant="ghost"
                size="icon-sm"
                aria-label={action.label}
                className={cn(view === action.id && "bg-muted text-foreground")}
                onClick={() => setView(action.id)}
              >
                <action.icon />
              </Button>
            ))}
            {onToggleRightSidebar ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={cn(
                        !rightSidebarOpen && "text-muted-foreground",
                      )}
                      aria-label={t("common:nav.toggleSecondaryPanel")}
                      onClick={onToggleRightSidebar}
                    >
                      <PanelRightIcon />
                    </Button>
                  }
                />
                <TooltipContent side="bottom">
                  {t("common:nav.toggleSecondaryPanel")}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {getPlatform() !== "macos" ? <WindowControls /> : null}
          </>
        }
      />

      {view === "info" ? (
        <SessionInfoPanel />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <TransferQueueContent />
        </div>
      )}
    </div>
  );
}

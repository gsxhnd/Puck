import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  CopyIcon,
  FolderOpenIcon,
  FolderTreeIcon,
  GitBranchIcon,
  InfoIcon,
  ListIcon,
  ListTreeIcon,
  PanelRightIcon,
} from "lucide-react";
import { TransferQueueContent } from "@/components/files/transfer-queue";
import { CommandOutlinePanel } from "@/components/workspace/command-outline-panel";
import { GitPanel } from "@/components/workspace/git-panel";
import { LocalFileExplorerPanel } from "@/components/workspace/local-file-explorer";
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

type PanelView = "info" | "files" | "git" | "outline" | "transfers";

const tabTransition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const;
const panelTransition = { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] } as const;

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

export function SecondPanel({
  secondPanelOpen = true,
  onToggleSecondPanel,
}: {
  secondPanelOpen?: boolean;
  onToggleSecondPanel?: () => void;
}) {
  const { t } = useTranslation(["info", "common"]);
  const [view, setView] = useState<PanelView>("info");

  const headerActions = useMemo(
    () =>
      [
        { id: "info" as const, icon: InfoIcon, label: t("info:title") },
        { id: "files" as const, icon: FolderTreeIcon, label: t("info:files") },
        { id: "git" as const, icon: GitBranchIcon, label: t("info:git") },
        { id: "outline" as const, icon: ListTreeIcon, label: t("info:outline") },
        { id: "transfers" as const, icon: ListIcon, label: t("info:transfers") },
      ] as const,
    [t],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-shell-secondary">
      <PanelHeader
        leading={
          <LayoutGroup id="second-panel-tabs">
            <div className="flex items-center gap-0.5">
              {headerActions.map((action) => {
                const isSelected = view === action.id;
                const tabButton = (
                  <motion.div layout transition={tabTransition}>
                    <Button
                      variant="ghost"
                      size={isSelected ? "xs" : "icon-xs"}
                      aria-label={action.label}
                      aria-pressed={isSelected}
                      className={cn(
                        "overflow-hidden",
                        isSelected
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground",
                      )}
                      onClick={() => setView(action.id)}
                    >
                      <action.icon />
                      <AnimatePresence initial={false} mode="popLayout">
                        {isSelected ? (
                          <motion.span
                            key={`${action.id}-label`}
                            layout
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={tabTransition}
                            className="overflow-hidden text-[10px] font-medium tracking-wide whitespace-nowrap"
                          >
                            {action.label}
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                );

                if (isSelected) {
                  return <div key={action.id}>{tabButton}</div>;
                }

                return (
                  <Tooltip key={action.id}>
                    <TooltipTrigger render={tabButton} />
                    <TooltipContent side="bottom">{action.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </LayoutGroup>
        }
        trailing={
          <>
            {onToggleSecondPanel ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={cn(
                        !secondPanelOpen && "text-muted-foreground",
                      )}
                      aria-label={t("common:nav.toggleSecondPanel")}
                      onClick={onToggleSecondPanel}
                    >
                      <PanelRightIcon />
                    </Button>
                  }
                />
                <TooltipContent side="bottom">
                  {t("common:nav.toggleSecondPanel")}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {getPlatform() !== "macos" ? <WindowControls /> : null}
          </>
        }
      />

      {secondPanelOpen ? (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {view === "info" ? (
              <motion.div
                key="info"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={panelTransition}
                className="flex min-h-0 flex-1 flex-col"
              >
                <SessionInfoPanel />
              </motion.div>
            ) : view === "files" ? (
              <motion.div
                key="files"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={panelTransition}
                className="flex min-h-0 flex-1 flex-col"
              >
                <LocalFileExplorerPanel />
              </motion.div>
            ) : view === "git" ? (
              <motion.div
                key="git"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={panelTransition}
                className="flex min-h-0 flex-1 flex-col"
              >
                <GitPanel />
              </motion.div>
            ) : view === "outline" ? (
              <motion.div
                key="outline"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={panelTransition}
                className="flex min-h-0 flex-1 flex-col"
              >
                <CommandOutlinePanel />
              </motion.div>
            ) : (
              <motion.div
                key="transfers"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={panelTransition}
                className="flex min-h-0 flex-1 flex-col"
              >
                <TransferQueueContent />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}

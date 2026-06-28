import { useTranslation } from "react-i18next";
import { TerminalIcon } from "lucide-react";
import { scrollTerminalToLine } from "@/lib/terminal-registry";
import {
  EMPTY_COMMAND_ENTRIES,
  useCommandOutlineStore,
  type CommandOutlineEntry,
} from "@/stores/command-outline-store";
import { useSessionStore } from "@/stores/session-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function CommandOutlineItem({
  entry,
  index,
  active,
  onJump,
}: {
  entry: CommandOutlineEntry;
  index: number;
  active: boolean;
  onJump: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
      onClick={onJump}
    >
      <span className="w-5 shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 font-mono text-xs break-all">
        {entry.command}
      </span>
    </button>
  );
}

export function CommandOutlinePanel() {
  const { t } = useTranslation("info");
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const entries = useCommandOutlineStore((state) =>
    activeSessionId
      ? (state.entriesBySession[activeSessionId] ?? EMPTY_COMMAND_ENTRIES)
      : EMPTY_COMMAND_ENTRIES,
  );
  const activeEntryId = useCommandOutlineStore((state) => state.activeEntryId);
  const setActiveEntry = useCommandOutlineStore((state) => state.setActiveEntry);

  const handleJump = (entry: CommandOutlineEntry) => {
    if (!activeSessionId) {
      return;
    }

    setActiveSession(activeSessionId);
    const jumped = scrollTerminalToLine(activeSessionId, entry.bufferLine);
    if (jumped) {
      setActiveEntry(entry.id);
    }
  };

  if (!activeSession || activeSession.kind !== "terminal") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("noActiveTerminal")}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
        <TerminalIcon className="size-5 opacity-50" />
        <p>{t("outlineEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-0.5 px-2 py-2">
        {[...entries].reverse().map((entry, index) => (
          <CommandOutlineItem
            key={entry.id}
            entry={entry}
            index={entries.length - index - 1}
            active={entry.id === activeEntryId}
            onJump={() => handleJump(entry)}
          />
        ))}
      </div>
      </ScrollArea>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { FolderOpenIcon, TerminalIcon } from "lucide-react";
import { useSessionStore } from "@/stores/session-store";
import { SettingsPage } from "@/components/settings/settings-page";
import { cn } from "@/lib/utils";

function TerminalPlaceholder() {
  const { t } = useTranslation("terminal");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <TerminalIcon className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("placeholder")}
        </p>
      </div>
    </div>
  );
}

function FilesPlaceholder() {
  const { t } = useTranslation("files");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <FolderOpenIcon className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("placeholder")}
        </p>
      </div>
    </div>
  );
}

function EmptyWorkspace() {
  const { t } = useTranslation(["common", "terminal"]);
  const addSession = useSessionStore((state) => state.addSession);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("common:app.name")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("common:empty.noSessions")}
        </p>
      </div>
      <button
        type="button"
        className={cn(
          "inline-flex h-9 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted",
        )}
        onClick={() =>
          addSession({
            kind: "terminal",
            title: "__local__",
            protocol: "local",
          })
        }
      >
        {t("common:actions.newTerminal")}
      </button>
    </div>
  );
}

export function MainWorkspace() {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  if (!activeSession) {
    return <EmptyWorkspace />;
  }

  switch (activeSession.kind) {
    case "settings":
      return <SettingsPage />;
    case "files":
      return <FilesPlaceholder />;
    case "terminal":
    default:
      return <TerminalPlaceholder />;
  }
}

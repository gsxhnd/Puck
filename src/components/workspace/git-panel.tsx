import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GitBranchIcon, RefreshCwIcon } from "lucide-react";
import { gitStatus } from "@/lib/tauri-workspace";
import { useActiveLocalSession } from "@/lib/use-active-local-session";
import { parsePuckError } from "@/lib/puck-error";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { GitStatusResult } from "@/types/workspace";

function statusLabel(status: string): string {
  switch (status) {
    case "M":
      return "M";
    case "A":
      return "A";
    case "D":
      return "D";
    case "R":
      return "R";
    case "?":
      return "?";
    default:
      return status.trim() || "·";
  }
}

function GitFileList({
  title,
  files,
  showStatus = true,
}: {
  title: string;
  files: Array<{ path: string; status?: string }>;
  showStatus?: boolean;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <section className="space-y-1">
      <h3 className="px-2 text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="space-y-0.5">
        {files.map((file) => (
          <div
            key={file.path}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
          >
            {showStatus && file.status ? (
              <span className="w-4 shrink-0 font-mono text-muted-foreground">
                {statusLabel(file.status)}
              </span>
            ) : null}
            <span className="min-w-0 flex-1 truncate font-mono">{file.path}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GitPanel() {
  const { t } = useTranslation("info");
  const { activeSession, isLocal, workspacePath } = useActiveLocalSession();
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await gitStatus(workspacePath);
      setStatus(result);
    } catch (err) {
      setError(parsePuckError(err).message);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    if (!isLocal) return;
    void refresh();
  }, [isLocal, refresh, activeSession?.id]);

  if (!activeSession || activeSession.kind !== "terminal") {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        {t("noActiveTerminal")}
      </div>
    );
  }

  if (!isLocal) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        {t("gitLocalOnly")}
      </div>
    );
  }

  if (!loading && status && !status.isRepo) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-end border-b border-border/60 px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("refresh")}
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCwIcon className={cn(loading && "animate-spin")} />
          </Button>
        </div>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("notAGitRepo")}
        </div>
      </div>
    );
  }

  const hasChanges =
    (status?.staged.length ?? 0) > 0 ||
    (status?.unstaged.length ?? 0) > 0 ||
    (status?.untracked.length ?? 0) > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">
            {status?.branch || t("detachedHead")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("refresh")}
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCwIcon className={cn(loading && "animate-spin")} />
        </Button>
      </div>

      {error ? (
        <div className="px-3 py-2 text-xs text-destructive">{error}</div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-2 py-3">
          <GitFileList
            title={t("gitStaged")}
            files={(status?.staged ?? []).map((file) => ({
              path: file.path,
              status: file.indexStatus,
            }))}
          />
          <GitFileList
            title={t("gitUnstaged")}
            files={(status?.unstaged ?? []).map((file) => ({
              path: file.path,
              status: file.worktreeStatus,
            }))}
          />
          <GitFileList
            title={t("gitUntracked")}
            files={(status?.untracked ?? []).map((path) => ({ path }))}
            showStatus={false}
          />

          {!loading && !hasChanges ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              {t("gitClean")}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

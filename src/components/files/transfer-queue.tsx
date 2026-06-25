import { useTranslation } from "react-i18next";
import { RefreshCwIcon, XIcon } from "lucide-react";
import {
  getRetryPayload,
  useTransferStore,
  type TransferTask,
} from "@/stores/transfer-store";
import { startTransfer } from "@/lib/tauri-sftp";
import { parsePuckError } from "@/lib/puck-error";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type TransferQueueProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function progressLabel(task: TransferTask) {
  if (task.bytesTotal) {
    const percent = Math.min(
      100,
      Math.round((task.bytesTransferred / task.bytesTotal) * 100),
    );
    return `${formatBytes(task.bytesTransferred)} / ${formatBytes(task.bytesTotal)} (${percent}%)`;
  }
  return formatBytes(task.bytesTransferred);
}

export function TransferQueue({ open, onOpenChange }: TransferQueueProps) {
  const { t } = useTranslation(["files", "common"]);
  const tasks = useTransferStore((state) => state.tasks);
  const markFailed = useTransferStore((state) => state.markFailed);
  const retryTask = useTransferStore((state) => state.retryTask);
  const removeTask = useTransferStore((state) => state.removeTask);
  const clearCompleted = useTransferStore((state) => state.clearCompleted);

  const handleRetry = async (task: TransferTask) => {
    retryTask(task.id);
    try {
      await startTransfer(getRetryPayload(task));
    } catch (error) {
      markFailed({
        transferId: task.id,
        message: parsePuckError(error).message,
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("common:nav.transferQueue")}</SheetTitle>
          <SheetDescription>{t("files:transfer.description")}</SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-end gap-2 px-4">
          <Button size="sm" variant="outline" onClick={clearCompleted}>
            {t("files:transfer.clearCompleted")}
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-8rem)] px-4">
          {tasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("files:transfer.empty")}
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border bg-card p-3 text-sm shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{task.fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.direction === "upload"
                          ? t("files:transfer.uploading")
                          : t("files:transfer.downloading")}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                      onClick={() => removeTask(task.id)}
                      aria-label={t("common:actions.close")}
                    >
                      <XIcon className="size-4" />
                    </button>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    {progressLabel(task)}
                  </div>

                  {task.bytesTotal ? (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full bg-primary transition-all",
                          task.status === "failed" && "bg-destructive",
                          task.status === "done" && "bg-emerald-500",
                        )}
                        style={{
                          width: `${Math.min(100, Math.round((task.bytesTransferred / task.bytesTotal) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-xs",
                        task.status === "failed" && "text-destructive",
                        task.status === "done" && "text-emerald-600",
                      )}
                    >
                      {t(`files:transfer.status.${task.status}`)}
                    </span>
                    {task.status === "failed" ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void handleRetry(task)}
                      >
                        <RefreshCwIcon className="size-3.5" />
                        {t("files:transfer.retry")}
                      </Button>
                    ) : null}
                  </div>

                  {task.errorMessage ? (
                    <div className="mt-2 text-xs text-destructive">
                      {task.errorMessage}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

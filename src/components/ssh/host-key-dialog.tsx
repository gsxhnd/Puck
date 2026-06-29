import { useTranslation } from "react-i18next";
import type { HostKeyPrompt } from "@/lib/puck-error";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type HostKeyDialogProps = {
  open: boolean;
  prompt: HostKeyPrompt | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function HostKeyDialog({
  open,
  prompt,
  onConfirm,
  onCancel,
}: HostKeyDialogProps) {
  const { t } = useTranslation(["connections", "common"]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="gap-5 p-5 sm:max-w-md">
        <DialogHeader className="gap-1.5 pr-8 text-left">
          <DialogTitle>{t("connections:hostKey.title")}</DialogTitle>
          <DialogDescription className="text-pretty">
            {t("connections:hostKey.description")}
          </DialogDescription>
        </DialogHeader>
        {prompt ? (
          <div className="space-y-3.5 rounded-lg border border-border/60 bg-muted/40 p-3.5">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("connections:fields.host")}
              </p>
              <p className="font-mono text-sm leading-5">
                {prompt.host}:{prompt.port}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("connections:hostKey.fingerprint")}
              </p>
              <p className="break-all font-mono text-xs leading-5 select-all">
                {prompt.fingerprint}
              </p>
            </div>
            <p className="break-all font-mono text-[11px] leading-5 text-muted-foreground select-all">
              {prompt.publicKey}
            </p>
          </div>
        ) : null}
        <DialogFooter className="-mx-5 -mb-5 mt-0 gap-2 border-t bg-muted/30 px-5 py-3.5 sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={onConfirm}>{t("connections:hostKey.trust")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

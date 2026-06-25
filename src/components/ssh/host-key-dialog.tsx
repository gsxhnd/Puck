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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("connections:hostKey.title")}</DialogTitle>
          <DialogDescription>{t("connections:hostKey.description")}</DialogDescription>
        </DialogHeader>
        {prompt ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <div>
              <span className="text-muted-foreground">
                {t("connections:fields.host")}:{" "}
              </span>
              {prompt.host}:{prompt.port}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("connections:hostKey.fingerprint")}:{" "}
              </span>
              {prompt.fingerprint}
            </div>
            <div className="break-all text-xs text-muted-foreground">
              {prompt.publicKey}
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={onConfirm}>{t("connections:hostKey.trust")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

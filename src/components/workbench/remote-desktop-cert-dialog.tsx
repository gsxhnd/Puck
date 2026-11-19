/**
 * Confirmation dialog for untrusted RDP server certificates.
 *
 * RDP 服务端证书确认对话框。展示主机、端口与证书 SHA-256 指纹；确认后把
 * 指纹写入信任存储并重新发起连接，拒绝则关闭提示并把标签置为失败。绝不
 * 静默接受不受信任的证书。
 */
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { openRemoteDesktopSession } from "@/lib/remote-desktop-session";
import { parsePuckError } from "@/lib/puck-error";
import {
  useRemoteDesktopCertStore,
} from "@/stores/remote-desktop-cert-store";
import { useWorkbenchStore } from "@/stores/workbench-store";

export function RemoteDesktopCertDialog() {
  const { t } = useTranslation("remoteDesktop");
  const prompt = useRemoteDesktopCertStore((state) => state.prompt);
  const clearPrompt = useRemoteDesktopCertStore((state) => state.clearPrompt);

  const confirm = async () => {
    if (!prompt) return;
    try {
      await invoke("trust_rdp_host", {
        host: prompt.host,
        port: prompt.port,
        fingerprint: prompt.fingerprint,
      });
      const { sessionId, profile } = prompt;
      // Close the failed tab and reconnect with the trusted fingerprint.
      // 关闭失败标签，以受信任的指纹重新连接。
      useWorkbenchStore.getState().closeTab(sessionId);
      clearPrompt(sessionId);
      openRemoteDesktopSession(profile);
    } catch (error) {
      toast.error(parsePuckError(error).message);
    }
  };

  const reject = () => {
    if (!prompt) return;
    const { sessionId } = prompt;
    clearPrompt(sessionId);
    useWorkbenchStore.getState().updateRemoteDesktopTab(sessionId, {
      status: "failed",
      errorMessage: t("certRejected"),
    });
  };

  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(open) => {
        if (!open && prompt) {
          reject();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("certTitle")}</DialogTitle>
          <DialogDescription>{t("certDescription")}</DialogDescription>
        </DialogHeader>
        {prompt ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {t("hostLabel")}
              </span>
              <span className="font-mono">
                {prompt.host}:{prompt.port}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {t("certFingerprint")}
              </span>
              <span className="break-all text-right font-mono text-xs">
                {prompt.fingerprint}
              </span>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={reject}>
            {t("certReject")}
          </Button>
          <Button onClick={() => void confirm()}>
            {t("certTrustAndConnect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SSH local port forwarding management panel.
 *
 * SSH 本地端口转发管理面板：创建 loopback listener、查看运行状态、停止转发
 * 并复制本地地址。转发生命周期同时受后端 SSH 与 Workspace 租约约束。
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CableIcon, CopyIcon, PlusIcon, SquareIcon } from "lucide-react";
import { toast } from "sonner";
import {
  listLocalPortForwards,
  onPortForwardStatus,
  startLocalPortForward,
  stopLocalPortForward,
  type PortForwardInfo,
} from "@/lib/tauri-port-forward";
import { parsePuckError } from "@/lib/puck-error";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PortsPanel() {
  const { t } = useTranslation("common");
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const remoteStatus = useWorkspaceStore((state) => state.remoteStatus);
  const connectionId = workspace?.source === "remote" ? workspace.profileId : undefined;
  const connected = Boolean(connectionId && remoteStatus === "connected");
  const [forwards, setForwards] = useState<PortForwardInfo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localPort, setLocalPort] = useState("0");
  const [remoteHost, setRemoteHost] = useState("127.0.0.1");
  const [remotePort, setRemotePort] = useState("8080");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setForwards([]);
    if (!connectionId || !connected) return;
    void listLocalPortForwards(connectionId).then((items) => {
      if (!cancelled) setForwards(items);
    }).catch((error) => toast.error(parsePuckError(error).message));

    const unlisten = onPortForwardStatus((event) => {
      if (event.connectionId !== connectionId || cancelled) return;
      if (event.status === "failed" && event.error) toast.error(event.error);
      setForwards((current) => {
        if (event.status !== "running") {
          return current.filter((item) => item.forwardId !== event.forwardId);
        }
        const exists = current.some((item) => item.forwardId === event.forwardId);
        return exists
          ? current.map((item) => item.forwardId === event.forwardId ? event : item)
          : [...current, event];
      });
    });
    return () => {
      cancelled = true;
      void unlisten.then((dispose) => dispose());
    };
  }, [connectionId, connected]);

  const addForward = useCallback(async () => {
    if (!connectionId) return;
    const local = Number(localPort);
    const remote = Number(remotePort);
    if (!Number.isInteger(local) || local < 0 || local > 65535 ||
        !Number.isInteger(remote) || remote < 1 || remote > 65535 ||
        !remoteHost.trim()) {
      toast.error(t("workspace.portInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      const created = await startLocalPortForward({
        forwardId: crypto.randomUUID(),
        connectionId,
        localHost: "127.0.0.1",
        localPort: local,
        remoteHost: remoteHost.trim(),
        remotePort: remote,
      });
      setForwards((current) => [
        ...current.filter((item) => item.forwardId !== created.forwardId),
        created,
      ]);
      setDialogOpen(false);
      setLocalPort("0");
    } catch (error) {
      toast.error(parsePuckError(error).message);
    } finally {
      setSubmitting(false);
    }
  }, [connectionId, localPort, remoteHost, remotePort, t]);

  const stop = useCallback(async (forwardId: string) => {
    try {
      await stopLocalPortForward(forwardId);
      setForwards((current) => current.filter((item) => item.forwardId !== forwardId));
    } catch (error) {
      toast.error(parsePuckError(error).message);
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center border-b border-border/60 px-2">
        <span className="px-1 text-xs font-medium">{t("workspace.ports")}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          aria-label={t("workspace.addPort")}
          disabled={!connected}
          onClick={() => setDialogOpen(true)}
        >
          <PlusIcon />
        </Button>
      </div>

      {!connected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-muted-foreground">
          <CableIcon className="size-5" />
          <p>{workspace?.source === "remote" ? t("workspace.portsDisconnected") : t("workspace.portsRemoteOnly")}</p>
        </div>
      ) : forwards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-xs text-muted-foreground">
          <CableIcon className="size-5" />
          <p>{t("workspace.noForwards")}</p>
          <Button variant="outline" size="xs" onClick={() => setDialogOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("workspace.addPort")}
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {forwards.map((forward) => (
            <div key={forward.forwardId} className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label={forward.status} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-mono text-xs">{forward.localAddress}</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  → {forward.remoteHost}:{forward.remotePort}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("workspace.copyAddress")}
                onClick={() => {
                  void navigator.clipboard.writeText(forward.localAddress);
                  toast.success(t("workspace.addressCopied"));
                }}
              >
                <CopyIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("workspace.stopPort")}
                onClick={() => void stop(forward.forwardId)}
              >
                <SquareIcon />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.addPort")}</DialogTitle>
            <DialogDescription>{t("workspace.portDescription")}</DialogDescription>
          </DialogHeader>
          <form
            id="add-port-forward"
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void addForward();
            }}
          >
            <label className="flex flex-col gap-1.5 text-xs">
              <span>{t("workspace.localPort")}</span>
              <Input
                type="number"
                min={0}
                max={65535}
                value={localPort}
                onChange={(event) => setLocalPort(event.target.value)}
                required
              />
              <span className="text-[10px] text-muted-foreground">{t("workspace.localPortHint")}</span>
            </label>
            <label className="flex flex-col gap-1.5 text-xs">
              <span>{t("workspace.remoteHost")}</span>
              <Input value={remoteHost} onChange={(event) => setRemoteHost(event.target.value)} required />
            </label>
            <label className="flex flex-col gap-1.5 text-xs">
              <span>{t("workspace.remotePort")}</span>
              <Input
                type="number"
                min={1}
                max={65535}
                value={remotePort}
                onChange={(event) => setRemotePort(event.target.value)}
                required
              />
            </label>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("actions.cancel")}</Button>
            <Button type="submit" form="add-port-forward" disabled={submitting}>
              {submitting ? t("workspace.startingPort") : t("workspace.startPort")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

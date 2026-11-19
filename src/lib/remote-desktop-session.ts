/**
 * Remote desktop session lifecycle entry point.
 *
 * 远程桌面会话生命周期入口：生成 sessionId、打开工作台标签（connecting）、
 * 解析凭据（不落盘、不日志）、调用 `start_remote_desktop`，并订阅
 * `session:status` 事件驱动标签状态。后端在握手阶段发现不受信任的服务端
 * 证书时通过 `remote_desktop:cert` 事件上报，本模块登记后交由确认对话框
 * 处理（确认 → 写入信任存储并重连；拒绝 → 标签置为失败）。
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ConnectionProfile } from "@/types/connection";
import { DEFAULT_PORTS } from "@/types/connection";
import { onSessionStatus } from "@/lib/tauri-ssh";
import {
  peekConnectionSecrets,
  resolveSecretsForConnection,
} from "@/lib/resolve-connection-credential";
import { parsePuckError } from "@/lib/puck-error";
import { useRemoteDesktopCertStore } from "@/stores/remote-desktop-cert-store";
import { useWorkbenchStore } from "@/stores/workbench-store";

/** Profiles keyed by sessionId so certificate prompts can reconnect. / 按 sessionId 记录配置，供证书提示确认后重连。 */
const profilesBySession = new Map<string, ConnectionProfile>();

let certListenerInstalled = false;

/** Installs the one-time listener for server certificate prompts. / 安装服务端证书提示的一次性监听。 */
async function ensureCertListener(): Promise<void> {
  if (certListenerInstalled) return;
  certListenerInstalled = true;

  await listen<unknown>("remote_desktop:cert", (event: { payload: unknown }) => {
    const payload = event.payload;
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("sessionId" in payload) ||
      !("host" in payload) ||
      !("port" in payload) ||
      !("fingerprint" in payload)
    ) {
      return;
    }
    const data = payload as {
      sessionId: string;
      host: string;
      port: number;
      fingerprint: string;
    };
    const profile = profilesBySession.get(data.sessionId);
    if (!profile) return;

    useRemoteDesktopCertStore.getState().setPrompt({
      sessionId: data.sessionId,
      host: data.host,
      port: data.port,
      fingerprint: data.fingerprint,
      profile,
    });
  });
}

/** Opens a remote desktop tab and starts the backend session. / 打开远程桌面标签并启动后端会话。 */
export function openRemoteDesktopSession(profile: ConnectionProfile): void {
  const protocol = profile.protocol;
  if (protocol !== "rdp" && protocol !== "vnc") return;

  const sessionId = crypto.randomUUID();
  const host = profile.host ?? "";
  profilesBySession.set(sessionId, profile);
  void ensureCertListener();

  useWorkbenchStore.getState().openRemoteDesktopTab({
    kind: "remoteDesktop",
    id: sessionId,
    sessionId,
    protocol,
    title: profile.name,
    host,
    status: "connecting",
  });

  void (async () => {
    // The backend drives the lifecycle through session:status events; the
    // unlisten detaches once the session reaches a terminal state.
    // 后端通过 session:status 事件驱动生命周期；到达终态后取消订阅。
    const unlisten = await onSessionStatus((event) => {
      if (event.sessionId !== sessionId) return;

      const store = useWorkbenchStore.getState();
      if (event.status === "connected") {
        store.updateRemoteDesktopTab(sessionId, { status: "connected" });
        unlisten();
        return;
      }
      if (event.status === "failed" || event.status === "disconnected") {
        store.updateRemoteDesktopTab(sessionId, {
          status: "failed",
          errorMessage: event.message ?? event.errorCode,
        });
        unlisten();
      }
    });

    // Credentials never touch persistent state; resolving may prompt the
    // user when the profile asks for the password each time.
    // 凭据不进入任何持久化状态；「每次询问」的配置在此弹出输入框。
    let password: string | undefined;
    try {
      const secrets =
        peekConnectionSecrets(profile.id) ??
        (await resolveSecretsForConnection(profile));
      password = secrets?.password ?? undefined;
    } catch (error) {
      unlisten();
      useWorkbenchStore.getState().updateRemoteDesktopTab(sessionId, {
        status: "failed",
        errorMessage: parsePuckError(error).message,
      });
      return;
    }

    try {
      await invoke("start_remote_desktop", {
        sessionId,
        protocol,
        host,
        port: profile.port ?? DEFAULT_PORTS[protocol],
        username: profile.username ?? null,
        password: password ?? null,
      });
    } catch (error) {
      unlisten();
      useWorkbenchStore.getState().updateRemoteDesktopTab(sessionId, {
        status: "failed",
        errorMessage: parsePuckError(error).message,
      });
    }
  })();
}

/** Cleans up the profile registration for a closed session. / 关闭会话时清理配置登记。 */
export function forgetRemoteDesktopSession(sessionId: string): void {
  profilesBySession.delete(sessionId);
}

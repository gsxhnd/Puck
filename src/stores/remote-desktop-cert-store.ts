/**
 * Pending RDP server certificate confirmation state.
 *
 * 待确认的 RDP 服务端证书提示状态。握手阶段发现不受信任的证书时，后端通过
 * `remote_desktop:cert` 事件上报指纹，本 store 持有该提示；用户确认后写入
 * 信任存储并重新连接，拒绝则把标签置为失败。
 */
import { create } from "zustand";
import type { ConnectionProfile } from "@/types/connection";

/** One pending server certificate confirmation. / 一条待确认的服务端证书。 */
export type RemoteDesktopCertPrompt = {
  sessionId: string;
  host: string;
  port: number;
  fingerprint: string;
  /** Profile used to reconnect after the user trusts the certificate. / 用户信任证书后用于重连的配置。 */
  profile: ConnectionProfile;
};

type RemoteDesktopCertStore = {
  prompt: RemoteDesktopCertPrompt | null;
  setPrompt: (prompt: RemoteDesktopCertPrompt) => void;
  clearPrompt: (sessionId: string) => void;
};

export const useRemoteDesktopCertStore = create<RemoteDesktopCertStore>()(
  (set) => ({
    prompt: null,
    setPrompt: (prompt) => set({ prompt }),
    clearPrompt: (sessionId) =>
      set((state) => ({
        prompt:
          state.prompt?.sessionId === sessionId ? null : state.prompt,
      })),
  }),
);

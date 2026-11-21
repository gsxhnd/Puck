/**
 * Supported remote protocol helpers.
 *
 * 远程协议辅助判断。Puck 的轻量定位只保留 SSH 与 SFTP；不再提供 FTP/FTPS
 * 占位或 RDP/VNC 图形远程协议。
 */
import type { TFunction } from "i18next";

export const IMPLEMENTED_REMOTE_PROTOCOLS = ["ssh", "sftp"] as const;

export type ImplementedRemoteProtocol =
  (typeof IMPLEMENTED_REMOTE_PROTOCOLS)[number];

export type RemoteProtocol = ImplementedRemoteProtocol;

export const REMOTE_PROTOCOL_SELECT_OPTIONS: Array<{
  protocol: RemoteProtocol;
}> = [
  { protocol: "ssh" },
  { protocol: "sftp" },
];

export function isSupportedRemoteProtocol(
  protocol: string,
): protocol is RemoteProtocol {
  return protocol === "ssh" || protocol === "sftp";
}

export function protocolOptionLabel(
  t: TFunction,
  protocol: RemoteProtocol,
): string {
  return t(`common:protocol.${protocol}`);
}

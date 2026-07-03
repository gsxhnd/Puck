/**
 * Remote protocol availability helpers for connection forms and session open.
 *
 * 远程协议可用性判断。FTP/FTPS 暂未实现，表单中禁用并在打开会话时拦截。
 */
import type { TFunction } from "i18next";
import type { ConnectionProtocol } from "@/types/connection";

export const IMPLEMENTED_REMOTE_PROTOCOLS = ["ssh", "sftp"] as const;

export type ImplementedRemoteProtocol =
  (typeof IMPLEMENTED_REMOTE_PROTOCOLS)[number];

export const UNIMPLEMENTED_REMOTE_PROTOCOLS = ["ftp", "ftps"] as const;

export type UnimplementedRemoteProtocol =
  (typeof UNIMPLEMENTED_REMOTE_PROTOCOLS)[number];

export type RemoteProtocol = Exclude<ConnectionProtocol, "local">;

export const REMOTE_PROTOCOL_SELECT_OPTIONS: Array<{
  protocol: RemoteProtocol;
  disabled: boolean;
}> = [
  { protocol: "ssh", disabled: false },
  { protocol: "sftp", disabled: false },
  { protocol: "ftp", disabled: true },
  { protocol: "ftps", disabled: true },
];

export function isImplementedRemoteProtocol(
  protocol: ConnectionProtocol,
): protocol is ImplementedRemoteProtocol {
  return protocol === "ssh" || protocol === "sftp";
}

export function isUnimplementedFileProtocol(
  protocol: ConnectionProtocol,
): protocol is UnimplementedRemoteProtocol {
  return protocol === "ftp" || protocol === "ftps";
}

export function protocolOptionLabel(
  t: TFunction,
  protocol: RemoteProtocol,
  disabled: boolean,
): string {
  const label = t(`common:protocol.${protocol}`);
  return disabled ? `${label} (${t("connections:protocol.comingSoon")})` : label;
}

/**
 * Core domain types for saved connections and runtime sessions.
 *
 * 连接与会话的核心领域类型：连接配置（协议、主机、认证方式等）、运行时
 * 会话（终端/文件标签）、连接状态枚举，以及创建配置/会话的工厂函数。
 */
export type ConnectionProtocol = "local" | "ssh" | "sftp" | "ftp" | "ftps";

export type AuthMethod = "none" | "password" | "privateKey" | "agent";

export type ConnectionProfile = {
  id: string;
  name: string;
  protocol: ConnectionProtocol;
  host?: string;
  port?: number;
  username?: string;
  authMethod?: AuthMethod;
  credentialRef?: string;
  privateKeyPath?: string;
  defaultDirectory?: string;
  terminalThemeId?: string;
  /** Runtime-only profile for quick connect; not persisted to disk. */
  ephemeral?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SessionStatus =
  | "creating"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed"
  | "closing";

export type SessionKind = "terminal" | "files";

export type SessionTitleMode = "name" | "prefix";

export type Session = {
  id: string;
  kind: SessionKind;
  title: string;
  profileId?: string;
  protocol?: ConnectionProtocol;
  shellId?: string;
  shellName?: string;
  tabLabel?: string;
  customTitle?: string;
  titleMode?: SessionTitleMode;
  titlePrefix?: string;
  cwd?: string;
  status: SessionStatus;
  createdAt: string;
};

export const DEFAULT_PORTS: Record<
  Exclude<ConnectionProtocol, "local">,
  number
> = {
  ssh: 22,
  sftp: 22,
  ftp: 21,
  ftps: 21,
};

export function createConnectionProfile(
  partial: Pick<ConnectionProfile, "name" | "protocol"> &
    Partial<Omit<ConnectionProfile, "id" | "name" | "protocol" | "createdAt" | "updatedAt">>,
): ConnectionProfile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: partial.name,
    protocol: partial.protocol,
    host: partial.host,
    port: partial.port,
    username: partial.username,
    authMethod: partial.authMethod,
    credentialRef: partial.credentialRef,
    privateKeyPath: partial.privateKeyPath,
    defaultDirectory: partial.defaultDirectory,
    terminalThemeId: partial.terminalThemeId,
    createdAt: now,
    updatedAt: now,
  };
}

export function createLocalProfile(name = "Local"): ConnectionProfile {
  return createConnectionProfile({
    name,
    protocol: "local",
    authMethod: "none",
  });
}

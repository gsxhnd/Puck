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

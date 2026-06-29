/**
 * Persistent CRUD store for saved connection profiles.
 *
 * 已保存连接配置（SSH/SFTP/FTP 等）的持久化 store，提供新增、更新、删除、
 * 复制、查询等操作。首次使用时以一组示例连接做种子数据；持久化时若磁盘已有
 * 非空数据则优先采用磁盘数据，避免示例覆盖用户已保存的连接。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { puckPersistStorage, PUCK_CONFIG_KEYS } from "@/lib/puck-config-storage";
import {
  type ConnectionProfile,
  createConnectionProfile,
} from "@/types/connection";

type ConnectionStore = {
  profiles: ConnectionProfile[];
  addProfile: (
    partial: Pick<ConnectionProfile, "name" | "protocol"> &
      Partial<Omit<ConnectionProfile, "id" | "name" | "protocol" | "createdAt" | "updatedAt">>,
  ) => ConnectionProfile;
  updateProfile: (
    id: string,
    patch: Partial<Omit<ConnectionProfile, "id" | "createdAt">>,
  ) => void;
  removeProfile: (id: string) => void;
  duplicateProfile: (id: string) => ConnectionProfile | undefined;
  getProfile: (id: string) => ConnectionProfile | undefined;
};

// 首次启动时的示例连接，帮助用户了解可配置的协议与字段。
const seedProfiles = (): ConnectionProfile[] => [
  createConnectionProfile({
    name: "Dev Server",
    protocol: "ssh",
    host: "192.168.1.10",
    port: 22,
    username: "deploy",
    authMethod: "privateKey",
    credentialRef: "puck.connection.dev-server.password",
  }),
  createConnectionProfile({
    name: "Staging SFTP",
    protocol: "sftp",
    host: "sftp.example.com",
    port: 22,
    username: "ops",
    authMethod: "password",
    defaultDirectory: "/var/www",
  }),
  createConnectionProfile({
    name: "FTP Backup",
    protocol: "ftp",
    host: "ftp.example.com",
    port: 21,
    username: "backup",
    authMethod: "password",
  }),
];

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      profiles: seedProfiles(),
      addProfile: (partial) => {
        const profile = createConnectionProfile(partial);
        set((state) => ({ profiles: [...state.profiles, profile] }));
        return profile;
      },
      updateProfile: (id, patch) => {
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === id
              ? {
                  ...profile,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                }
              : profile,
          ),
        }));
      },
      removeProfile: (id) => {
        set((state) => ({
          profiles: state.profiles.filter((profile) => profile.id !== id),
        }));
      },
      duplicateProfile: (id) => {
        const source = get().profiles.find((profile) => profile.id === id);
        if (!source) return undefined;
        const copy = createConnectionProfile({
          name: `${source.name} (copy)`,
          protocol: source.protocol,
          host: source.host,
          port: source.port,
          username: source.username,
          authMethod: source.authMethod,
          credentialRef: source.credentialRef,
          privateKeyPath: source.privateKeyPath,
          defaultDirectory: source.defaultDirectory,
          terminalThemeId: source.terminalThemeId,
        });
        set((state) => ({ profiles: [...state.profiles, copy] }));
        return copy;
      },
      getProfile: (id) => get().profiles.find((profile) => profile.id === id),
    }),
    {
      name: PUCK_CONFIG_KEYS.connections,
      storage: puckPersistStorage,
      merge: (persisted, current) => {
        const stored = persisted as Partial<ConnectionStore> | undefined;
        if (stored?.profiles && stored.profiles.length > 0) {
          return {
            ...current,
            profiles: stored.profiles.filter(
              (profile) => profile.protocol !== "local",
            ),
          };
        }
        return current;
      },
    },
  ),
);

/**
 * Persistent CRUD store for saved connection profiles.
 *
 * 已保存连接配置（SSH/SFTP/FTP 等）的持久化 store，提供新增、更新、删除、
 * 复制、查询等操作。rehydrate 时优先采用磁盘数据（含空列表），不注入示例连接。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CONNECTIONS_PERSIST_KEY,
  connectionPersistStorage,
} from "@/lib/connection-persist-storage";
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
  addEphemeralProfile: (
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

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      addProfile: (partial) => {
        const profile = createConnectionProfile(partial);
        set((state) => ({ profiles: [...state.profiles, profile] }));
        return profile;
      },
      addEphemeralProfile: (partial) => {
        const profile = { ...createConnectionProfile(partial), ephemeral: true };
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
          askPasswordEachTime: source.askPasswordEachTime,
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
      name: CONNECTIONS_PERSIST_KEY,
      storage: connectionPersistStorage,
      skipHydration: true,
      partialize: (state) => ({
        profiles: state.profiles.filter((profile) => !profile.ephemeral),
      }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<ConnectionStore> | undefined;
        if (stored?.profiles !== undefined) {
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

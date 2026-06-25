import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type ConnectionProfile,
  createConnectionProfile,
  createLocalProfile,
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

const seedProfiles = (): ConnectionProfile[] => [
  createLocalProfile(),
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
      name: "puck-connections",
      merge: (persisted, current) => {
        const stored = persisted as Partial<ConnectionStore> | undefined;
        if (stored?.profiles && stored.profiles.length > 0) {
          return { ...current, profiles: stored.profiles };
        }
        return current;
      },
    },
  ),
);

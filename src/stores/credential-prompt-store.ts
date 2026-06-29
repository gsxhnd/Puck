import { create } from "zustand";
import type { ConnectionProfile } from "@/types/connection";

export type CredentialField = "password" | "passphrase";

type CredentialPromptRequest = {
  profile: ConnectionProfile;
  field: CredentialField;
  resolve: (value: string | null) => void;
};

type CredentialPromptStore = {
  request: CredentialPromptRequest | null;
  pendingByKey: Map<string, Promise<string | null>>;
  prompt: (
    profile: ConnectionProfile,
    field: CredentialField,
  ) => Promise<string | null>;
  submit: (value: string) => void;
  cancel: () => void;
};

function promptKey(profileId: string, field: CredentialField): string {
  return `${profileId}:${field}`;
}

export const useCredentialPromptStore = create<CredentialPromptStore>()(
  (set, get) => ({
    request: null,
    pendingByKey: new Map(),
    prompt: (profile, field) => {
      const key = promptKey(profile.id, field);
      const existing = get().pendingByKey.get(key);
      if (existing) {
        return existing;
      }

      let promise!: Promise<string | null>;
      promise = new Promise<string | null>((resolve) => {
        const finish = (value: string | null) => {
          const pending = get().pendingByKey;
          if (pending.get(key) === promise) {
            pending.delete(key);
            set({ pendingByKey: new Map(pending) });
          }
          resolve(value);
        };

        set({
          request: { profile, field, resolve: finish },
          pendingByKey: new Map(get().pendingByKey).set(key, promise),
        });
      });

      return promise;
    },
    submit: (value) => {
      const current = get().request;
      if (!current) return;
      current.resolve(value);
      set({ request: null });
    },
    cancel: () => {
      const current = get().request;
      if (!current) return;
      current.resolve(null);
      set({ request: null });
    },
  }),
);

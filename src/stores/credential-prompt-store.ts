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
  prompt: (
    profile: ConnectionProfile,
    field: CredentialField,
  ) => Promise<string | null>;
  submit: (value: string) => void;
  cancel: () => void;
};

export const useCredentialPromptStore = create<CredentialPromptStore>()(
  (set, get) => ({
    request: null,
    prompt: (profile, field) =>
      new Promise((resolve) => {
        set({ request: { profile, field, resolve } });
      }),
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

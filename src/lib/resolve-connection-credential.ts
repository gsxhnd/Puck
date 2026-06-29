import type { ConnectionProfile } from "@/types/connection";
import { useCredentialPromptStore } from "@/stores/credential-prompt-store";
import { hasCredential, saveCredential } from "@/lib/tauri-ssh";

export type ConnectionSecrets = {
  password?: string;
  passphrase?: string;
};

const pendingSecrets = new Map<string, ConnectionSecrets>();

export function stashConnectionSecrets(
  profileId: string,
  secrets: ConnectionSecrets,
): void {
  pendingSecrets.set(profileId, secrets);
}

export function takeConnectionSecrets(
  profileId: string,
): ConnectionSecrets | undefined {
  const secrets = pendingSecrets.get(profileId);
  pendingSecrets.delete(profileId);
  return secrets;
}

export async function resolveConnectionCredential(
  profile: ConnectionProfile,
): Promise<ConnectionSecrets | null> {
  if (profile.authMethod === "password") {
    if (profile.askPasswordEachTime) {
      const password = await useCredentialPromptStore
        .getState()
        .prompt(profile, "password");
      return password ? { password } : null;
    }

    const has = await hasCredential(profile.id, "password");
    if (has) {
      return {};
    }

    const password = await useCredentialPromptStore
      .getState()
      .prompt(profile, "password");
    if (!password) {
      return null;
    }
    await saveCredential(profile.id, "password", password);
    return {};
  }

  if (profile.authMethod === "privateKey") {
    if (profile.askPasswordEachTime) {
      const passphrase = await useCredentialPromptStore
        .getState()
        .prompt(profile, "passphrase");
      return passphrase !== null ? { passphrase } : null;
    }

    return {};
  }

  return {};
}

export async function prepareProfileConnection(
  profile: ConnectionProfile,
): Promise<boolean> {
  if (profile.authMethod !== "password" && profile.authMethod !== "privateKey") {
    return true;
  }

  const secrets = await resolveConnectionCredential(profile);
  if (secrets === null) {
    return false;
  }

  if (secrets.password || secrets.passphrase) {
    stashConnectionSecrets(profile.id, secrets);
  }

  return true;
}

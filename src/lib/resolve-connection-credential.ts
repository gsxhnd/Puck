import type { ConnectionProfile } from "@/types/connection";
import { useCredentialPromptStore } from "@/stores/credential-prompt-store";
import { hasCredential, saveCredential } from "@/lib/tauri-ssh";

export type ConnectionSecrets = {
  password?: string;
  passphrase?: string;
};

type ConnectionEstablishmentKind = "ssh" | "sftp";

const pendingSecrets = new Map<string, ConnectionSecrets>();
const establishmentFlags = new Map<string, Set<ConnectionEstablishmentKind>>();
const inflightResolutions = new Map<string, Promise<ConnectionSecrets | null>>();

export function stashConnectionSecrets(
  profileId: string,
  secrets: ConnectionSecrets,
): void {
  pendingSecrets.set(profileId, secrets);
}

export function peekConnectionSecrets(
  profileId: string,
): ConnectionSecrets | undefined {
  return pendingSecrets.get(profileId);
}

export function clearConnectionSecrets(profileId: string): void {
  pendingSecrets.delete(profileId);
  inflightResolutions.delete(profileId);
}

export function resetConnectionEstablishment(profileId: string): void {
  establishmentFlags.delete(profileId);
}

/** Clears stashed secrets once every required connection leg has succeeded. */
export function markConnectionEstablished(
  profileId: string,
  kind: ConnectionEstablishmentKind,
  required: ConnectionEstablishmentKind[],
): void {
  const flags = establishmentFlags.get(profileId) ?? new Set();
  flags.add(kind);
  establishmentFlags.set(profileId, flags);

  if (required.every((item) => flags.has(item))) {
    clearConnectionSecrets(profileId);
    establishmentFlags.delete(profileId);
  }
}

/**
 * Returns stashed secrets for the current connection attempt, prompting at most once.
 * Concurrent callers share the same in-flight resolution.
 */
export async function resolveSecretsForConnection(
  profile: ConnectionProfile,
): Promise<ConnectionSecrets | null> {
  if (pendingSecrets.has(profile.id)) {
    return peekConnectionSecrets(profile.id)!;
  }

  const inflight = inflightResolutions.get(profile.id);
  if (inflight) {
    return inflight;
  }

  const resolution = (async () => {
    const resolved = await resolveConnectionCredential(profile);
    if (resolved === null) {
      return null;
    }

    stashConnectionSecrets(profile.id, resolved);
    return resolved;
  })();

  inflightResolutions.set(profile.id, resolution);

  try {
    return await resolution;
  } finally {
    if (inflightResolutions.get(profile.id) === resolution) {
      inflightResolutions.delete(profile.id);
    }
  }
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

  resetConnectionEstablishment(profile.id);
  if (profile.askPasswordEachTime) {
    clearConnectionSecrets(profile.id);
  }

  return (await resolveSecretsForConnection(profile)) !== null;
}

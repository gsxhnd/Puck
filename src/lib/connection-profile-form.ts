/**
 * Shared connection profile form state, validation, and persistence helpers.
 *
 * 连接配置表单的共享逻辑：状态转换、保存前校验、凭据写入钥匙串。
 */
import type { TFunction } from "i18next";
import type { AuthMethod, ConnectionProfile, ConnectionProtocol } from "@/types/connection";
import { DEFAULT_PORTS } from "@/types/connection";
import { isImplementedRemoteProtocol } from "@/lib/connection-protocol";
import {
  deleteCredential,
  saveCredential,
} from "@/lib/tauri-ssh";

export type ConnectionProfileFormState = {
  name: string;
  protocol: Exclude<ConnectionProtocol, "local">;
  host: string;
  port: string;
  username: string;
  authMethod: AuthMethod;
  askPasswordEachTime: boolean;
  password: string;
  passphrase: string;
  privateKeyPath: string;
  defaultDirectory: string;
};

export type ConnectionProfileValidationField =
  | "host"
  | "username"
  | "port"
  | "privateKeyPath"
  | "protocol";

export type ConnectionProfileValidationErrors = Partial<
  Record<ConnectionProfileValidationField, string>
>;

export function profileToForm(profile: ConnectionProfile): ConnectionProfileFormState {
  return {
    name: profile.name,
    protocol:
      profile.protocol === "local"
        ? "ssh"
        : (profile.protocol as Exclude<ConnectionProtocol, "local">),
    host: profile.host ?? "",
    port: String(profile.port ?? DEFAULT_PORTS.ssh),
    username: profile.username ?? "",
    authMethod: profile.authMethod ?? "password",
    askPasswordEachTime: profile.askPasswordEachTime ?? false,
    password: "",
    passphrase: "",
    privateKeyPath: profile.privateKeyPath ?? "",
    defaultDirectory: profile.defaultDirectory ?? "",
  };
}

export function emptyConnectionForm(): ConnectionProfileFormState {
  return {
    name: "",
    protocol: "ssh",
    host: "",
    port: String(DEFAULT_PORTS.ssh),
    username: "",
    authMethod: "password",
    askPasswordEachTime: false,
    password: "",
    passphrase: "",
    privateKeyPath: "",
    defaultDirectory: "",
  };
}

export function parseFormPort(form: ConnectionProfileFormState): number | null {
  const port = Number.parseInt(form.port.trim(), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return port;
}

export function validateConnectionProfileForm(
  form: ConnectionProfileFormState,
  t: TFunction,
): ConnectionProfileValidationErrors {
  const errors: ConnectionProfileValidationErrors = {};

  if (!isImplementedRemoteProtocol(form.protocol)) {
    errors.protocol = t("connections:validation.protocolNotSupported");
  }

  if (!form.host.trim()) {
    errors.host = t("connections:validation.hostRequired");
  }

  if (!form.username.trim()) {
    errors.username = t("connections:validation.usernameRequired");
  }

  if (parseFormPort(form) === null) {
    errors.port = t("connections:validation.portInvalid");
  }

  if (form.authMethod === "privateKey" && !form.privateKeyPath.trim()) {
    errors.privateKeyPath = t("connections:validation.privateKeyRequired");
  }

  return errors;
}

export function hasValidationErrors(
  errors: ConnectionProfileValidationErrors,
): boolean {
  return Object.keys(errors).length > 0;
}

export function formToProfilePayload(
  form: ConnectionProfileFormState,
  untitledLabel: string,
) {
  const port = parseFormPort(form) ?? DEFAULT_PORTS[form.protocol];

  return {
    name: form.name.trim() || untitledLabel,
    protocol: form.protocol,
    host: form.host.trim(),
    port,
    username: form.username.trim(),
    authMethod: form.authMethod,
    askPasswordEachTime:
      form.authMethod === "password" || form.authMethod === "privateKey"
        ? form.askPasswordEachTime
        : undefined,
    privateKeyPath:
      form.authMethod === "privateKey" ? form.privateKeyPath.trim() : undefined,
    defaultDirectory: form.defaultDirectory.trim() || undefined,
  };
}

export async function persistConnectionCredentials(
  connectionId: string,
  form: ConnectionProfileFormState,
) {
  if (form.askPasswordEachTime) {
    if (form.authMethod === "password") {
      await deleteCredential(connectionId, "password");
    }
    if (form.authMethod === "privateKey") {
      await deleteCredential(connectionId, "passphrase");
    }
    return;
  }

  if (form.authMethod === "password" && form.password) {
    await saveCredential(connectionId, "password", form.password);
  }
  if (form.authMethod === "privateKey" && form.passphrase) {
    await saveCredential(connectionId, "passphrase", form.passphrase);
  }
}

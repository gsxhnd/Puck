import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { PlugIcon } from "lucide-react";
import type { AuthMethod, ConnectionProfile, ConnectionProtocol } from "@/types/connection";
import { DEFAULT_PORTS } from "@/types/connection";
import { useConnectionStore } from "@/stores/connection-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import { openProfileSession } from "@/lib/open-profile-session";
import {
  isImplementedRemoteProtocol,
  protocolOptionLabel,
  REMOTE_PROTOCOL_SELECT_OPTIONS,
} from "@/lib/connection-protocol";
import {
  deleteConnectionCredentials,
  deleteCredential,
  saveCredential,
} from "@/lib/tauri-ssh";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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

function ensureImplementedProtocol(
  protocol: Exclude<ConnectionProtocol, "local">,
  t: ReturnType<typeof useTranslation>[0],
): boolean {
  if (isImplementedRemoteProtocol(protocol)) {
    return true;
  }

  toast.error(t("connections:protocolNotSupported.title"), {
    description: t("connections:protocolNotSupported.description"),
  });
  return false;
}

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

export function formToProfilePayload(
  form: ConnectionProfileFormState,
  untitledLabel: string,
) {
  const port = Number.parseInt(form.port, 10);
  return {
    name: form.name.trim() || untitledLabel,
    protocol: form.protocol,
    host: form.host.trim(),
    port: Number.isFinite(port) ? port : DEFAULT_PORTS[form.protocol],
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

async function persistCredentials(connectionId: string, form: ConnectionProfileFormState) {
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

function ConnectionProfileFields({
  form,
  isEditing,
  onChange,
  onPickPrivateKey,
}: {
  form: ConnectionProfileFormState;
  isEditing: boolean;
  onChange: <K extends keyof ConnectionProfileFormState>(
    key: K,
    value: ConnectionProfileFormState[K],
  ) => void;
  onPickPrivateKey: () => void;
}) {
  const { t } = useTranslation(["connections", "common"]);

  const handleProtocolChange = (protocol: Exclude<ConnectionProtocol, "local">) => {
    if (!isImplementedRemoteProtocol(protocol)) {
      return;
    }

    onChange("protocol", protocol);
    onChange("port", String(DEFAULT_PORTS[protocol]));
  };

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">
          {t("connections:fields.name")}
        </span>
        <Input
          value={form.name}
          onChange={(event) => onChange("name", event.target.value)}
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">
          {t("connections:fields.protocol")}
        </span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={form.protocol}
          onChange={(event) =>
            handleProtocolChange(
              event.target.value as Exclude<ConnectionProtocol, "local">,
            )
          }
        >
          {REMOTE_PROTOCOL_SELECT_OPTIONS.map(({ protocol, disabled }) => (
            <option key={protocol} value={protocol} disabled={disabled}>
              {protocolOptionLabel(t, protocol, disabled)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">
            {t("connections:fields.host")}
          </span>
          <Input
            value={form.host}
            onChange={(event) => onChange("host", event.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">
            {t("connections:fields.port")}
          </span>
          <Input
            value={form.port}
            onChange={(event) => onChange("port", event.target.value)}
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">
          {t("connections:fields.username")}
        </span>
        <Input
          value={form.username}
          onChange={(event) => onChange("username", event.target.value)}
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">
          {t("connections:fields.authMethod")}
        </span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={form.authMethod}
          onChange={(event) =>
            onChange("authMethod", event.target.value as AuthMethod)
          }
        >
          <option value="password">{t("connections:auth.password")}</option>
          <option value="privateKey">{t("connections:auth.privateKey")}</option>
        </select>
      </label>

      {(form.authMethod === "password" || form.authMethod === "privateKey") ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.askPasswordEachTime}
            onCheckedChange={(checked) =>
              onChange("askPasswordEachTime", checked === true)
            }
          />
          <span>{t("connections:auth.askPasswordEachTime")}</span>
        </label>
      ) : null}

      {form.authMethod === "password" && !form.askPasswordEachTime ? (
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">
            {t("connections:fields.password")}
          </span>
          <Input
            type="password"
            value={form.password}
            placeholder={
              isEditing ? t("connections:fields.passwordKeep") : undefined
            }
            onChange={(event) => onChange("password", event.target.value)}
          />
        </label>
      ) : null}

      {form.authMethod === "password" && form.askPasswordEachTime ? (
        <p className="text-xs text-muted-foreground">
          {t("connections:auth.askPasswordEachTimeHint")}
        </p>
      ) : null}

      {form.authMethod === "privateKey" ? (
        <>
          <div className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">
              {t("connections:fields.privateKey")}
            </span>
            <div className="flex gap-2">
              <Input
                value={form.privateKeyPath}
                onChange={(event) =>
                  onChange("privateKeyPath", event.target.value)
                }
              />
              <Button type="button" variant="outline" onClick={onPickPrivateKey}>
                {t("common:actions.open")}
              </Button>
            </div>
          </div>
          {!form.askPasswordEachTime ? (
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">
                {t("connections:fields.passphrase")}
              </span>
              <Input
                type="password"
                value={form.passphrase}
                placeholder={
                  isEditing ? t("connections:fields.passwordKeep") : undefined
                }
                onChange={(event) => onChange("passphrase", event.target.value)}
              />
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("connections:auth.askPassphraseEachTimeHint")}
            </p>
          )}
        </>
      ) : null}

      {(form.protocol === "sftp" || form.protocol === "ssh") && (
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">
            {t("connections:fields.defaultDirectory")}
          </span>
          <Input
            value={form.defaultDirectory}
            onChange={(event) =>
              onChange("defaultDirectory", event.target.value)
            }
          />
        </label>
      )}
    </div>
  );
}

export function ConnectionProfilePanel({
  profileId,
}: {
  profileId: string | null;
}) {
  const { t } = useTranslation(["connections", "common"]);
  const addProfile = useConnectionStore((state) => state.addProfile);
  const updateProfile = useConnectionStore((state) => state.updateProfile);
  const removeProfile = useConnectionStore((state) => state.removeProfile);
  const openHostEditor = useShellUiStore((state) => state.openHostEditor);
  const closeHostEditor = useShellUiStore((state) => state.closeHostEditor);
  const profile = useConnectionStore((state) =>
    profileId ? state.getProfile(profileId) : undefined,
  );
  const isEditing = Boolean(profileId && profile && profile.protocol !== "local");
  const [form, setForm] = useState<ConnectionProfileFormState>(emptyConnectionForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing && profile) {
      setForm(profileToForm(profile));
      return;
    }
    setForm(emptyConnectionForm());
  }, [isEditing, profile, profileId]);

  const updateField = <K extends keyof ConnectionProfileFormState>(
    key: K,
    value: ConnectionProfileFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const pickPrivateKey = async () => {
    const selected = await open({
      multiple: false,
      title: t("connections:fields.privateKey"),
    });
    if (typeof selected === "string") {
      updateField("privateKeyPath", selected);
    }
  };

  const handleSave = async () => {
    if (!ensureImplementedProtocol(form.protocol, t)) {
      return;
    }

    setSaving(true);
    try {
      const payload = formToProfilePayload(
        form,
        t("connections:newDialog.untitled"),
      );

      if (isEditing && profileId) {
        updateProfile(profileId, payload);
      } else {
        const created = addProfile(payload);
        await persistCredentials(created.id, form);
        openHostEditor(created.id);
        return;
      }

      if (profileId) {
        await persistCredentials(profileId, form);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!profileId || !profile) return;
    if (!ensureImplementedProtocol(form.protocol, t)) {
      return;
    }

    setSaving(true);
    try {
      await persistCredentials(profileId, form);
      updateProfile(profileId, formToProfilePayload(form, profile.name));
      const latest = useConnectionStore.getState().getProfile(profileId);
      if (!latest) return;
      await openProfileSession(latest);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!profileId) return;
    if (!window.confirm(t("connections:manager.deleteConfirm"))) return;
    await deleteConnectionCredentials(profileId);
    removeProfile(profileId);
    closeHostEditor();
  };

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {isEditing
              ? t("connections:editDialog.title")
              : t("connections:newDialog.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEditing
              ? t("connections:editDialog.description")
              : t("connections:newDialog.description")}
          </p>
        </div>

        <ConnectionProfileFields
          form={form}
          isEditing={isEditing}
          onChange={updateField}
          onPickPrivateKey={() => void pickPrivateKey()}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          {isEditing ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
            >
              {t("common:actions.delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void handleConnect()}
              >
                <PlugIcon />
                {t("connections:manager.connect")}
              </Button>
            ) : null}
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {t("common:actions.save")}
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

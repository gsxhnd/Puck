import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import type { AuthMethod, ConnectionProfile, ConnectionProtocol } from "@/types/connection";
import { DEFAULT_PORTS } from "@/types/connection";
import { useConnectionStore } from "@/stores/connection-store";
import { openProfileSession } from "@/lib/open-profile-session";
import {
  deleteConnectionCredentials,
  deleteCredential,
  saveCredential,
} from "@/lib/tauri-ssh";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type ConnectionDialogProps = {
  open: boolean;
  profileId?: string | null;
  mode?: "default" | "quickConnect";
  onOpenChange: (open: boolean) => void;
};

type FormState = {
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

const REMOTE_PROTOCOLS: Array<Exclude<ConnectionProtocol, "local">> = [
  "ssh",
  "sftp",
  "ftp",
  "ftps",
];

function profileToForm(profile: ConnectionProfile): FormState {
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

function emptyForm(): FormState {
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

function formToProfilePayload(form: FormState, untitledLabel: string) {
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

async function persistCredentials(connectionId: string, form: FormState) {
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

export function ConnectionDialog({
  open: dialogOpen,
  profileId,
  mode = "default",
  onOpenChange,
}: ConnectionDialogProps) {
  const { t } = useTranslation(["connections", "common"]);
  const addProfile = useConnectionStore((state) => state.addProfile);
  const addEphemeralProfile = useConnectionStore((state) => state.addEphemeralProfile);
  const updateProfile = useConnectionStore((state) => state.updateProfile);
  const removeProfile = useConnectionStore((state) => state.removeProfile);
  const profile = useConnectionStore((state) =>
    profileId ? state.getProfile(profileId) : undefined,
  );
  const isEditing = Boolean(profileId && profile && profile.protocol !== "local");
  const isQuickConnect = mode === "quickConnect" && !isEditing;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dialogOpen) return;
    if (isEditing && profile) {
      setForm(profileToForm(profile));
      return;
    }
    setForm(emptyForm());
  }, [dialogOpen, isEditing, profile]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleProtocolChange = (protocol: Exclude<ConnectionProtocol, "local">) => {
    setForm((current) => ({
      ...current,
      protocol,
      port: String(DEFAULT_PORTS[protocol]),
    }));
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
    setSaving(true);
    try {
      const payload = formToProfilePayload(
        form,
        t("connections:newDialog.untitled"),
      );

      let connectionId = profileId ?? "";
      if (isEditing && profileId) {
        updateProfile(profileId, payload);
      } else {
        const created = addProfile(payload);
        connectionId = created.id;
      }

      await persistCredentials(connectionId, form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setSaving(true);
    try {
      const payload = formToProfilePayload(
        form,
        t("connections:newDialog.untitled"),
      );
      const profile = addEphemeralProfile(payload);
      await persistCredentials(profile.id, form);
      await openProfileSession(profile);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!profileId) return;
    await deleteConnectionCredentials(profileId);
    removeProfile(profileId);
    onOpenChange(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("connections:editDialog.title")
              : isQuickConnect
                ? t("connections:quickConnect.title")
                : t("connections:newDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t("connections:editDialog.description")
              : isQuickConnect
                ? t("connections:quickConnect.description")
                : t("connections:newDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">
              {t("connections:fields.name")}
            </span>
            <Input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
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
              {REMOTE_PROTOCOLS.map((protocol) => (
                <option key={protocol} value={protocol}>
                  {t(`common:protocol.${protocol}`)}
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
                onChange={(event) => updateField("host", event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">
                {t("connections:fields.port")}
              </span>
              <Input
                value={form.port}
                onChange={(event) => updateField("port", event.target.value)}
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">
              {t("connections:fields.username")}
            </span>
            <Input
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
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
                updateField("authMethod", event.target.value as AuthMethod)
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
                  updateField("askPasswordEachTime", checked === true)
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
                onChange={(event) => updateField("password", event.target.value)}
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
                      updateField("privateKeyPath", event.target.value)
                    }
                  />
                  <Button type="button" variant="outline" onClick={() => void pickPrivateKey()}>
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
                    onChange={(event) => updateField("passphrase", event.target.value)}
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
                  updateField("defaultDirectory", event.target.value)
                }
              />
            </label>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            {isQuickConnect ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {t("common:actions.save")}
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleConnect()}
                >
                  {t("connections:manager.connect")}
                </Button>
              </>
            ) : (
              <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                {t("common:actions.save")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

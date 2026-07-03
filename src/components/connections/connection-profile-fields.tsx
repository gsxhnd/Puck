import { useTranslation } from "react-i18next";
import type { AuthMethod, ConnectionProtocol } from "@/types/connection";
import { DEFAULT_PORTS } from "@/types/connection";
import {
  isImplementedRemoteProtocol,
  protocolOptionLabel,
  REMOTE_PROTOCOL_SELECT_OPTIONS,
} from "@/lib/connection-protocol";
import type {
  ConnectionProfileFormState,
  ConnectionProfileValidationErrors,
} from "@/lib/connection-profile-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function ConnectionProfileFields({
  form,
  isEditing,
  errors,
  onChange,
  onPickPrivateKey,
}: {
  form: ConnectionProfileFormState;
  isEditing: boolean;
  errors?: ConnectionProfileValidationErrors;
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
        <FieldError message={errors?.protocol} />
      </label>

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">
            {t("connections:fields.host")}
          </span>
          <Input
            aria-invalid={Boolean(errors?.host)}
            value={form.host}
            onChange={(event) => onChange("host", event.target.value)}
          />
          <FieldError message={errors?.host} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">
            {t("connections:fields.port")}
          </span>
          <Input
            aria-invalid={Boolean(errors?.port)}
            value={form.port}
            onChange={(event) => onChange("port", event.target.value)}
          />
          <FieldError message={errors?.port} />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">
          {t("connections:fields.username")}
        </span>
        <Input
          aria-invalid={Boolean(errors?.username)}
          value={form.username}
          onChange={(event) => onChange("username", event.target.value)}
        />
        <FieldError message={errors?.username} />
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
                aria-invalid={Boolean(errors?.privateKeyPath)}
                value={form.privateKeyPath}
                onChange={(event) =>
                  onChange("privateKeyPath", event.target.value)
                }
              />
              <Button type="button" variant="outline" onClick={onPickPrivateKey}>
                {t("common:actions.open")}
              </Button>
            </div>
            <FieldError message={errors?.privateKeyPath} />
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

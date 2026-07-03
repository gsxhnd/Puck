import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { useConnectionStore } from "@/stores/connection-store";
import { openProfileSession } from "@/lib/open-profile-session";
import {
  emptyConnectionForm,
  formToProfilePayload,
  hasValidationErrors,
  persistConnectionCredentials,
  profileToForm,
  validateConnectionProfileForm,
  type ConnectionProfileFormState,
  type ConnectionProfileValidationErrors,
} from "@/lib/connection-profile-form";
import { deleteConnectionCredentials } from "@/lib/tauri-ssh";
import { ConnectionProfileFields } from "@/components/connections/connection-profile-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConnectionDialogProps = {
  open: boolean;
  profileId?: string | null;
  mode?: "default" | "quickConnect";
  onOpenChange: (open: boolean) => void;
};

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
  const [form, setForm] = useState<ConnectionProfileFormState>(emptyConnectionForm);
  const [fieldErrors, setFieldErrors] = useState<ConnectionProfileValidationErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dialogOpen) return;
    setFieldErrors({});
    if (isEditing && profile) {
      setForm(profileToForm(profile));
      return;
    }
    setForm(emptyConnectionForm());
  }, [dialogOpen, isEditing, profile]);

  const updateField = <K extends keyof ConnectionProfileFormState>(
    key: K,
    value: ConnectionProfileFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as keyof ConnectionProfileValidationErrors];
      return next;
    });
  };

  const validateForm = (): boolean => {
    const errors = validateConnectionProfileForm(form, t);
    setFieldErrors(errors);
    if (errors.protocol) {
      toast.error(t("connections:protocolNotSupported.title"), {
        description: t("connections:protocolNotSupported.description"),
      });
    }
    return !hasValidationErrors(errors);
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
    if (!validateForm()) {
      return;
    }

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

      await persistConnectionCredentials(connectionId, form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const payload = formToProfilePayload(
        form,
        t("connections:newDialog.untitled"),
      );
      const profile = addEphemeralProfile(payload);
      await persistConnectionCredentials(profile.id, form);
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

        <ConnectionProfileFields
          form={form}
          isEditing={isEditing}
          errors={fieldErrors}
          onChange={updateField}
          onPickPrivateKey={() => void pickPrivateKey()}
        />

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

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { PlugIcon } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
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
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [fieldErrors, setFieldErrors] = useState<ConnectionProfileValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setFieldErrors({});
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

      if (isEditing && profileId) {
        updateProfile(profileId, payload);
      } else {
        const created = addProfile(payload);
        await persistConnectionCredentials(created.id, form);
        openHostEditor(created.id);
        return;
      }

      if (profileId) {
        await persistConnectionCredentials(profileId, form);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!profileId || !profile) return;
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await persistConnectionCredentials(profileId, form);
      updateProfile(profileId, formToProfilePayload(form, profile.name));
      const latest = useConnectionStore.getState().getProfile(profileId);
      if (!latest) return;
      await openProfileSession(latest);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!profileId) return;
    await deleteConnectionCredentials(profileId);
    removeProfile(profileId);
    closeHostEditor();
  };

  return (
    <>
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
          errors={fieldErrors}
          onChange={updateField}
          onPickPrivateKey={() => void pickPrivateKey()}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          {isEditing ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
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
    <ConfirmDialog
      open={deleteConfirmOpen}
      description={t("connections:manager.deleteConfirm")}
      confirmLabel={t("common:actions.delete")}
      destructive
      onConfirm={() => void confirmDelete()}
      onOpenChange={setDeleteConfirmOpen}
    />
    </>
  );
}

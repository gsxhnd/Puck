import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCredentialPromptStore } from "@/stores/credential-prompt-store";

export function CredentialPromptDialog() {
  const { t } = useTranslation(["connections", "common"]);
  const request = useCredentialPromptStore((state) => state.request);
  const submit = useCredentialPromptStore((state) => state.submit);
  const cancel = useCredentialPromptStore((state) => state.cancel);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (request) {
      setValue("");
    }
  }, [request]);

  if (!request) {
    return null;
  }

  const isPassword = request.field === "password";
  const title = isPassword
    ? t("connections:credentialPrompt.passwordTitle")
    : t("connections:credentialPrompt.passphraseTitle");
  const description = t("connections:credentialPrompt.description", {
    name: request.profile.name,
  });
  const label = isPassword
    ? t("connections:fields.password")
    : t("connections:fields.passphrase");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(value);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && cancel()}>
      <DialogContent className="gap-5 p-5 sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="gap-1.5 pr-8 text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-pretty">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <Input
                type="password"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
              />
            </label>
          </div>
          <DialogFooter className="-mx-5 -mb-5 mt-0 gap-2 border-t bg-muted/30 px-5 py-3.5 sm:justify-end">
            <Button type="button" variant="outline" onClick={cancel}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={isPassword && !value}>
              {t("connections:credentialPrompt.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useTranslation } from "react-i18next";
import type { Session } from "@/types/connection";
import { getSessionPathDisplay } from "@/lib/session-display";

type TerminalPathBarProps = {
  session: Session;
};

export function TerminalPathBar({ session }: TerminalPathBarProps) {
  const { t } = useTranslation("terminal");
  const path = getSessionPathDisplay(session);

  return (
    <div className="flex h-7 shrink-0 items-center bg-muted/20 px-3">
      <span className="truncate font-mono text-xs text-muted-foreground">
        {path || t("pathUnknown", { defaultValue: "~" })}
      </span>
    </div>
  );
}

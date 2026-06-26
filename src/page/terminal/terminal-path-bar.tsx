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
    <span className="pointer-events-none truncate font-mono text-xs text-muted-foreground">
      {path || t("pathUnknown", { defaultValue: "~" })}
    </span>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { listShells } from "@/lib/tauri-terminal";
import { useSessionStore } from "@/stores/session-store";
import type { ShellInfo } from "@/types/shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NewTerminalMenuProps = {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "xs" | "icon" | "icon-xs";
  className?: string;
  showLabel?: boolean;
};

export function NewTerminalMenu({
  variant = "outline",
  size = "sm",
  className,
  showLabel = true,
}: NewTerminalMenuProps) {
  const { t } = useTranslation(["common", "terminal"]);
  const addSession = useSessionStore((state) => state.addSession);
  const [shells, setShells] = useState<ShellInfo[]>([]);

  useEffect(() => {
    void listShells()
      .then(setShells)
      .catch(() => setShells([]));
  }, []);

  const openDefault = () => {
    addSession({
      kind: "terminal",
      title: "__local__",
      protocol: "local",
    });
  };

  const openShell = (shell: ShellInfo) => {
    addSession({
      kind: "terminal",
      title: shell.name,
      protocol: "local",
      shellId: shell.id,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant={variant} size={size} className={className}>
            <PlusIcon />
            {showLabel ? (
              <>
                {t("common:actions.newTerminal")}
                <ChevronDownIcon className="opacity-60" />
              </>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("terminal:pickShell")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={openDefault}>
            {t("terminal:localDefault")}
          </DropdownMenuItem>
          {shells.map((shell) => (
            <DropdownMenuItem key={shell.id} onClick={() => openShell(shell)}>
              <span className="truncate">{shell.name}</span>
              <span className="ml-auto text-xs text-muted-foreground uppercase">
                {shell.kind}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

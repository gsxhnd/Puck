import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { formatShortcut } from "@/lib/format-shortcut";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { PaletteCommand } from "@/components/command-palette/types";

/**
 * A single selectable row in the command palette list.
 *
 * 命令面板列表中的单行命令项，支持选中高亮、勾选态、快捷键与子菜单箭头。
 */
export function CommandPaletteItem({
  command,
  active,
  onSelect,
  onHover,
}: {
  command: PaletteCommand;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      disabled={command.disabled}
      data-active={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        active ? "bg-muted text-foreground" : "text-foreground/90 hover:bg-muted/70",
        command.disabled && "cursor-not-allowed opacity-50",
      )}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {command.checked ? <CheckIcon className="size-3.5 text-primary" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{command.label}</span>
      {command.shortcut ? (
        <Kbd className="bg-transparent text-[10px] text-muted-foreground">
          {formatShortcut(command.shortcut)}
        </Kbd>
      ) : null}
      {command.hasSubmenu ? (
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </button>
  );
}

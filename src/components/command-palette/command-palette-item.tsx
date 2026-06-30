import { CheckIcon } from "lucide-react";
import { formatShortcut } from "@/lib/format-shortcut";
import { splitShortcutKeys } from "@/lib/split-shortcut";
import { cn } from "@/lib/utils";
import type { PaletteCommand } from "@/components/command-palette/types";

function PaletteShortcut({ shortcut }: { shortcut: string }) {
  const keys = splitShortcutKeys(formatShortcut(shortcut));

  return (
    <span className="flex shrink-0 items-center gap-[3px]">
      {keys.map((key, index) => (
        <kbd
          key={`${key}-${index}`}
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-[#3a3a3a] bg-[#2a2a2a] px-[5px] text-[11px] font-normal leading-none text-[#888888]"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

/**
 * A single selectable row in the command palette list.
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
  const Icon = command.icon;

  return (
    <button
      type="button"
      disabled={command.disabled}
      data-active={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[6px] px-2 py-[7px] text-left text-[13px] transition-colors",
        active
          ? "bg-[#2d2d2d] text-[#ffffff]"
          : "text-[#e8e8e8] hover:bg-[#252525]",
        command.disabled && "cursor-not-allowed opacity-40",
      )}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <span
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center",
          active ? "text-[#cccccc]" : "text-[#888888]",
        )}
      >
        {command.checked ? (
          <CheckIcon className="size-3.5 text-[#7cacf8]" strokeWidth={1.75} />
        ) : Icon ? (
          <Icon className="size-[15px]" strokeWidth={1.75} />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate font-normal">{command.label}</span>
      {command.shortcut ? <PaletteShortcut shortcut={command.shortcut} /> : null}
    </button>
  );
}

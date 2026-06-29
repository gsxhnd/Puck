import type { ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { TerminalSplitDirection } from "@/types/terminal-split";
import type { OpenInAppId } from "@/lib/open-in-app";
import { getPlatform } from "@/lib/platform";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/** Submenu identifiers for the terminal title popover. */
export type TitleSubmenuId = "openIn" | "notifications" | "split";

/** External apps available under the "Open In" submenu. */
export const OPEN_IN_APPS: Array<{ id: OpenInAppId; labelKey: string }> = [
  { id: "vscode", labelKey: "titleMenu.apps.vscode" },
  { id: "cursor", labelKey: "titleMenu.apps.cursor" },
  { id: "xcode", labelKey: "titleMenu.apps.xcode" },
  { id: "zed", labelKey: "titleMenu.apps.zed" },
  { id: "finder", labelKey: "titleMenu.apps.finder" },
  { id: "terminal", labelKey: "titleMenu.apps.terminal" },
];

/** Terminal split directions with their keyboard shortcuts. */
export const SPLIT_ACTIONS: Array<{
  direction: TerminalSplitDirection;
  labelKey: string;
  shortcut: string;
}> = [
  { direction: "right", labelKey: "titleMenu.split.right", shortcut: "⌘D" },
  { direction: "left", labelKey: "titleMenu.split.left", shortcut: "⌥⌘D" },
  { direction: "down", labelKey: "titleMenu.split.down", shortcut: "⇧⌘D" },
  { direction: "up", labelKey: "titleMenu.split.up", shortcut: "⌥⇧⌘D" },
];

/** Platform-aware shortcut label (macOS symbols vs Ctrl/Shift/Alt). */
export function formatTitleMenuShortcut(keys: string): string {
  const isMac = getPlatform() === "macos";
  return keys
    .replace(/⌘/g, isMac ? "⌘" : "Ctrl+")
    .replace(/⇧/g, isMac ? "⇧" : "Shift+")
    .replace(/⌥/g, isMac ? "⌥" : "Alt+");
}

/**
 * A single row in the terminal title popover menu.
 *
 * 终端标题弹出菜单中的单行条目，可选显示快捷键与子菜单箭头。
 */
export function TitleMenuItem({
  label,
  shortcut,
  hasSubmenu,
  active,
  onClick,
  onMouseEnter,
  children,
}: {
  label: string;
  shortcut?: string;
  hasSubmenu?: boolean;
  active?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-hidden transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground/90 hover:bg-muted/70",
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {children}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <Kbd className="bg-transparent text-[10px] text-muted-foreground group-hover:text-inherit">
          {formatTitleMenuShortcut(shortcut)}
        </Kbd>
      ) : null}
      {hasSubmenu ? (
        <ChevronRightIcon className="size-3.5 shrink-0 opacity-70" />
      ) : null}
    </button>
  );
}

/**
 * Leaf item inside a fly-out submenu (no further nesting).
 *
 * 标题菜单二级子菜单中的叶子条目（不再嵌套子菜单）。
 */
export function TitleMenuSubmenuItem({
  label,
  shortcut,
  onClick,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground/90 hover:bg-muted/70"
      onClick={onClick}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <Kbd className="bg-transparent text-[10px] text-muted-foreground">
          {formatTitleMenuShortcut(shortcut)}
        </Kbd>
      ) : null}
    </button>
  );
}

/**
 * Fly-out panel anchored to the right of a parent menu item.
 *
 * 标题菜单的二级飞出面板，定位在父菜单项右侧；`open` 为 false 时不渲染。
 */
export function TitleMenuSubmenu({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute top-0 left-full z-50 flex pl-1">
      <div
        className={cn(
          "min-w-40 rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

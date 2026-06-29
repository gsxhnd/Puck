import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  BellIcon,
  ChevronRightIcon,
  FolderIcon,
  RotateCcwIcon,
  Volume2Icon,
} from "lucide-react";
import type { Session, SessionTitleMode } from "@/types/connection";
import {
  getSessionPathDisplay,
  getSessionTitleEditorValue,
  getTerminalHeaderTitle,
} from "@/lib/session-display";
import { openPathInApp, type OpenInAppId } from "@/lib/open-in-app";
import { getPlatform, isTauri } from "@/lib/platform";
import { focusTerminal } from "@/lib/terminal-registry";
import { useSessionStore } from "@/stores/session-store";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";
import { useTerminalSplitStore } from "@/stores/terminal-split-store";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import type { TerminalSplitDirection } from "@/types/terminal-split";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TerminalPrivilegesSubmenu } from "@/page/terminal/terminal-privileges-submenu";

type TerminalPathBarProps = {
  session: Session;
};

type SubmenuId = "openIn" | "notifications" | "split";

const OPEN_IN_APPS: Array<{ id: OpenInAppId; labelKey: string }> = [
  { id: "vscode", labelKey: "titleMenu.apps.vscode" },
  { id: "cursor", labelKey: "titleMenu.apps.cursor" },
  { id: "xcode", labelKey: "titleMenu.apps.xcode" },
  { id: "zed", labelKey: "titleMenu.apps.zed" },
  { id: "finder", labelKey: "titleMenu.apps.finder" },
  { id: "terminal", labelKey: "titleMenu.apps.terminal" },
];

function formatShortcut(keys: string): string {
  const isMac = getPlatform() === "macos";
  return keys
    .replace(/⌘/g, isMac ? "⌘" : "Ctrl+")
    .replace(/⇧/g, isMac ? "⇧" : "Shift+")
    .replace(/⌥/g, isMac ? "⌥" : "Alt+");
}

function TitleMenuItem({
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
  children?: React.ReactNode;
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
          {formatShortcut(shortcut)}
        </Kbd>
      ) : null}
      {hasSubmenu ? (
        <ChevronRightIcon className="size-3.5 shrink-0 opacity-70" />
      ) : null}
    </button>
  );
}

const SPLIT_ACTIONS: Array<{
  direction: TerminalSplitDirection;
  labelKey: string;
  shortcut: string;
}> = [
  { direction: "right", labelKey: "titleMenu.split.right", shortcut: "⌘D" },
  { direction: "left", labelKey: "titleMenu.split.left", shortcut: "⌥⌘D" },
  { direction: "down", labelKey: "titleMenu.split.down", shortcut: "⇧⌘D" },
  { direction: "up", labelKey: "titleMenu.split.up", shortcut: "⌥⇧⌘D" },
];

function TitleMenuSubmenuItem({
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
          {formatShortcut(shortcut)}
        </Kbd>
      ) : null}
    </button>
  );
}

function TitleMenuSubmenu({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
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

export function TerminalPathBar({ session }: TerminalPathBarProps) {
  const { t } = useTranslation("terminal");
  const [open, setOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId | null>(null);
  const [titleMode, setTitleMode] = useState<SessionTitleMode>(
    session.titleMode ?? "name",
  );
  const [draftTitle, setDraftTitle] = useState(() =>
    getSessionTitleEditorValue(session),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const updateSessionTitle = useSessionStore(
    (state) => state.updateSessionTitle,
  );
  const resetSessionTitle = useSessionStore((state) => state.resetSessionTitle);
  const openSearch = useTerminalSearchStore((state) => state.openSearch);
  const splitSession = useTerminalSplitStore((state) => state.splitSession);
  const openPalette = useCommandPaletteStore((state) => state.openPalette);

  const headerTitle = getTerminalHeaderTitle(session);
  const path = getSessionPathDisplay(session);
  const resolvedPath = session.cwd ?? path;

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitleMode(session.titleMode ?? "name");
    setDraftTitle(getSessionTitleEditorValue(session));
    requestAnimationFrame(() => inputRef.current?.select());
  }, [open, session]);

  const commitTitle = () => {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      return;
    }

    if (titleMode === "prefix") {
      updateSessionTitle(session.id, {
        titleMode: "prefix",
        titlePrefix: trimmed,
      });
      return;
    }

    updateSessionTitle(session.id, {
      titleMode: "name",
      customTitle: trimmed,
    });
  };

  const handleResetTitle = () => {
    resetSessionTitle(session.id);
    setTitleMode("name");
    setDraftTitle(session.tabLabel ?? headerTitle);
  };

  const copyPath = async () => {
    await navigator.clipboard.writeText(path);
    setOpen(false);
  };

  const revealPath = async () => {
    if (!resolvedPath || !isTauri()) {
      return;
    }

    try {
      await revealItemInDir(resolvedPath);
      setOpen(false);
    } catch {
      toast.error(t("titleMenu.revealFailed"));
    }
  };

  const handleOpenInApp = async (app: OpenInAppId) => {
    if (!resolvedPath) {
      return;
    }

    try {
      await openPathInApp(resolvedPath, app);
      setOpen(false);
    } catch {
      toast.error(t("titleMenu.openInFailed"));
    }
  };

  const handleFind = (scope: "tab" | "all") => {
    openSearch(scope);
    focusTerminal(session.id);
    setOpen(false);
  };

  const handleJumpTo = () => {
    focusTerminal(session.id);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("puck:focus-outline"));
  };

  const handleCommandPalette = () => {
    setOpen(false);
    openPalette();
  };

  const handleSplit = (direction: TerminalSplitDirection) => {
    splitSession(session.id, direction);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setActiveSubmenu(null);
        }
      }}
    >
      <PopoverTrigger
        className={cn(
          "inline-flex max-w-md items-center rounded-md px-2 py-1 font-mono text-xs text-muted-foreground transition-colors",
          "hover:bg-muted/60 hover:text-foreground data-popup-open:bg-muted/60 data-popup-open:text-foreground",
        )}
      >
        <span className="truncate">{headerTitle}</span>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={6}
        className="w-72 gap-0 p-0"
      >
        <div className="space-y-2 p-2.5">
          <div className="flex items-center gap-2">
            <ButtonGroup className="flex-1">
              <Button
                type="button"
                size="xs"
                variant={titleMode === "name" ? "secondary" : "ghost"}
                className="flex-1"
                onClick={() => {
                  setTitleMode("name");
                  setDraftTitle(
                    session.customTitle ??
                      session.tabLabel ??
                      getSessionTitleEditorValue(session),
                  );
                }}
              >
                {t("titleMenu.name")}
              </Button>
              <Button
                type="button"
                size="xs"
                variant={titleMode === "prefix" ? "secondary" : "ghost"}
                className="flex-1"
                onClick={() => {
                  setTitleMode("prefix");
                  setDraftTitle(
                    session.titlePrefix ??
                      getSessionTitleEditorValue({
                        ...session,
                        titleMode: "prefix",
                      }),
                  );
                }}
              >
                {t("titleMenu.prefix")}
              </Button>
            </ButtonGroup>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={t("titleMenu.resetTitle")}
              onClick={handleResetTitle}
            >
              <RotateCcwIcon className="size-3.5" />
            </Button>
          </div>

          <Input
            ref={inputRef}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitTitle();
                setOpen(false);
              }
              if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            className="h-8 font-mono text-xs"
          />
        </div>

        <Separator />

        <div className="space-y-1 px-2.5 py-2">
          <p className="px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {t("titleMenu.workingDirectory")}
          </p>
          <div className="flex items-center gap-2 px-1 font-mono text-xs text-foreground/90">
            <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{path || "~"}</span>
          </div>
        </div>

        <Separator />

        <div className="relative p-1">
          <TitleMenuItem label={t("titleMenu.copyPath")} onClick={() => void copyPath()} />
          <TitleMenuItem
            label={t("titleMenu.revealInFinder")}
            onClick={() => void revealPath()}
          />

          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("openIn")}
          >
            <TitleMenuItem
              label={t("titleMenu.openIn")}
              hasSubmenu
              active={activeSubmenu === "openIn"}
            />
            <TitleMenuSubmenu open={activeSubmenu === "openIn"}>
              {OPEN_IN_APPS.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/70"
                  onClick={() => void handleOpenInApp(app.id)}
                >
                  <span className="size-4 shrink-0 rounded-sm bg-muted" />
                  <span>{t(app.labelKey)}</span>
                </button>
              ))}
            </TitleMenuSubmenu>
          </div>

          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("notifications")}
          >
            <TitleMenuItem
              label={t("titleMenu.notificationsPrivileges")}
              hasSubmenu
              active={activeSubmenu === "notifications"}
            >
              <Volume2Icon className="size-3.5 shrink-0 opacity-70" />
              <BellIcon className="size-3.5 shrink-0 opacity-70" />
            </TitleMenuItem>
            <TitleMenuSubmenu
              open={activeSubmenu === "notifications"}
              className="min-w-56"
            >
              <TerminalPrivilegesSubmenu sessionId={session.id} />
            </TitleMenuSubmenu>
          </div>

          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("split")}
          >
            <TitleMenuItem
              label={t("titleMenu.splitView")}
              hasSubmenu
              active={activeSubmenu === "split"}
            />
            <TitleMenuSubmenu open={activeSubmenu === "split"} className="min-w-52">
              {SPLIT_ACTIONS.map((action) => (
                <TitleMenuSubmenuItem
                  key={action.direction}
                  label={t(action.labelKey)}
                  shortcut={action.shortcut}
                  onClick={() => handleSplit(action.direction)}
                />
              ))}
            </TitleMenuSubmenu>
          </div>

          <Separator className="my-1" />

          <TitleMenuItem
            label={t("titleMenu.find")}
            shortcut="⌘F"
            onClick={() => handleFind("tab")}
          />
          <TitleMenuItem
            label={t("titleMenu.findInAllTabs")}
            shortcut="⇧⌘F"
            onClick={() => handleFind("all")}
          />
          <TitleMenuItem
            label={t("titleMenu.jumpTo")}
            shortcut="⌘J"
            onClick={handleJumpTo}
          />
          <TitleMenuItem
            label={t("titleMenu.commandPalette")}
            shortcut="⇧⌘P"
            onClick={handleCommandPalette}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

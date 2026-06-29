import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { BellIcon, FolderIcon, RotateCcwIcon, Volume2Icon } from "lucide-react";
import type { Session, SessionTitleMode } from "@/types/connection";
import {
  getSessionPathDisplay,
  getSessionTitleEditorValue,
  getTerminalHeaderTitle,
} from "@/lib/session-display";
import { openPathInApp } from "@/lib/open-in-app";
import { isTauri } from "@/lib/platform";
import { focusTerminal } from "@/lib/terminal-registry";
import { useSessionStore } from "@/stores/session-store";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";
import { useTerminalSplitStore } from "@/stores/terminal-split-store";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import type { TerminalSplitDirection } from "@/types/terminal-split";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TerminalPrivilegesSubmenu } from "@/page/terminal/terminal-privileges-submenu";
import {
  OPEN_IN_APPS,
  SPLIT_ACTIONS,
  TitleMenuItem,
  TitleMenuSubmenu,
  TitleMenuSubmenuItem,
  type TitleSubmenuId,
} from "@/page/terminal/terminal-path-bar-title-menu";

/**
 * Terminal tab title bar with path display and action popover.
 *
 * 终端工作区顶部的标题/路径栏。点击后弹出菜单，可重命名标签（名称或前缀模式）、
 * 查看工作目录、复制/在 Finder 中显示路径、用外部应用打开、管理会话权限、
 * 分屏、搜索、跳转大纲以及打开命令面板。
 */
export function TerminalPathBar({ session }: { session: Session }) {
  const { t } = useTranslation("terminal");
  const [open, setOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<TitleSubmenuId | null>(null);
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

  const handleOpenInApp = async (app: (typeof OPEN_IN_APPS)[number]["id"]) => {
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

  const clearSubmenu = () => setActiveSubmenu(null);

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
          "window-title-bar-interactive inline-flex max-w-md items-center rounded-md px-2 py-1 font-mono text-xs text-muted-foreground transition-colors",
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
          <TitleMenuItem
            label={t("titleMenu.copyPath")}
            onMouseEnter={clearSubmenu}
            onClick={() => void copyPath()}
          />
          <TitleMenuItem
            label={t("titleMenu.revealInFinder")}
            onMouseEnter={clearSubmenu}
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
            onMouseEnter={clearSubmenu}
            onClick={() => handleFind("tab")}
          />
          <TitleMenuItem
            label={t("titleMenu.findInAllTabs")}
            shortcut="⇧⌘F"
            onMouseEnter={clearSubmenu}
            onClick={() => handleFind("all")}
          />
          <TitleMenuItem
            label={t("titleMenu.jumpTo")}
            shortcut="⌘J"
            onMouseEnter={clearSubmenu}
            onClick={handleJumpTo}
          />
          <TitleMenuItem
            label={t("titleMenu.commandPalette")}
            shortcut="⇧⌘P"
            onMouseEnter={clearSubmenu}
            onClick={handleCommandPalette}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

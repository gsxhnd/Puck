import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { CheckIcon, ChevronRightIcon, FolderIcon, SearchIcon } from "lucide-react";
import { formatShortcut } from "@/lib/format-shortcut";
import { openPathInApp, type OpenInAppId } from "@/lib/open-in-app";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { getSessionPathDisplay } from "@/lib/session-display";
import { isTauri } from "@/lib/platform";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSessionStore } from "@/stores/session-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";
import type { SecondPanelView } from "@/types/shell-ui";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const OPEN_IN_APPS: Array<{ id: OpenInAppId; labelKey: string }> = [
  { id: "vscode", labelKey: "terminal:titleMenu.apps.vscode" },
  { id: "cursor", labelKey: "terminal:titleMenu.apps.cursor" },
  { id: "xcode", labelKey: "terminal:titleMenu.apps.xcode" },
  { id: "zed", labelKey: "terminal:titleMenu.apps.zed" },
  { id: "finder", labelKey: "terminal:titleMenu.apps.finder" },
  { id: "terminal", labelKey: "terminal:titleMenu.apps.terminal" },
];

type CommandSection = "workingDirectory" | "view" | "openIn";

type PaletteCommand = {
  id: string;
  section: CommandSection;
  label: string;
  shortcut?: string;
  checked?: boolean;
  hasSubmenu?: boolean;
  keywords?: string[];
  disabled?: boolean;
  run: () => void | Promise<void>;
};

function matchesQuery(command: PaletteCommand, query: string): boolean {
  if (!query.trim()) {
    return true;
  }

  const haystack = [command.label, ...(command.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function CommandPaletteItem({
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

export function CommandPalette() {
  const { t } = useTranslation(["commandPalette", "terminal", "common"]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const open = useCommandPaletteStore((state) => state.open);
  const page = useCommandPaletteStore((state) => state.page);
  const closePalette = useCommandPaletteStore((state) => state.closePalette);
  const setPage = useCommandPaletteStore((state) => state.setPage);

  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  const primaryPanelOpen = useShellUiStore((state) => state.primaryPanelOpen);
  const secondPanelOpen = useShellUiStore((state) => state.secondPanelOpen);
  const secondPanelView = useShellUiStore((state) => state.secondPanelView);
  const togglePrimaryPanel = useShellUiStore((state) => state.togglePrimaryPanel);
  const toggleSecondPanel = useShellUiStore((state) => state.toggleSecondPanel);
  const showSecondPanelView = useShellUiStore((state) => state.showSecondPanelView);
  const openSearch = useTerminalSearchStore((state) => state.openSearch);

  const path =
    activeSession?.kind === "terminal"
      ? getSessionPathDisplay(activeSession)
      : null;
  const resolvedPath = activeSession?.cwd ?? path ?? null;
  const terminalActive = activeSession?.kind === "terminal";

  const rootCommands = useMemo<PaletteCommand[]>(() => {
    const viewDetail = (view: SecondPanelView, label: string) => ({
      id: `details-${view}`,
      section: "view" as const,
      label,
      checked: secondPanelOpen && secondPanelView === view,
      keywords: [view, "details"],
      run: () => showSecondPanelView(view),
    });

    const commands: PaletteCommand[] = [
      {
        id: "toggle-tabs",
        section: "view",
        label: t("commandPalette:commands.toggleTabsPanel"),
        shortcut: "⇧⌘L",
        checked: primaryPanelOpen,
        keywords: ["tabs", "sidebar", "primary"],
        run: () => togglePrimaryPanel(),
      },
      {
        id: "toggle-details",
        section: "view",
        label: t("commandPalette:commands.toggleDetailsPanel"),
        shortcut: "⇧⌘R",
        checked: secondPanelOpen,
        keywords: ["details", "second", "right"],
        run: () => toggleSecondPanel(),
      },
      viewDetail("info", t("commandPalette:commands.detailsInfo")),
      viewDetail("outline", t("commandPalette:commands.detailsOutline")),
      viewDetail("files", t("commandPalette:commands.detailsFiles")),
      viewDetail("git", t("commandPalette:commands.detailsGit")),
      viewDetail("transfers", t("commandPalette:commands.detailsTransfers")),
      {
        id: "open-settings",
        section: "view",
        label: t("commandPalette:commands.openSettings"),
        shortcut: "⌘,",
        keywords: ["settings", "preferences"],
        run: () => void openSettingsWindow(),
      },
    ];

    if (terminalActive) {
      commands.unshift(
        {
          id: "open-in",
          section: "workingDirectory",
          label: t("commandPalette:commands.openIn"),
          hasSubmenu: true,
          disabled: !resolvedPath,
          keywords: ["open", "editor", "finder"],
          run: () => setPage("open-in"),
        },
        {
          id: "reveal",
          section: "workingDirectory",
          label: t("commandPalette:commands.revealInFinder"),
          disabled: !resolvedPath || !isTauri(),
          keywords: ["finder", "reveal"],
          run: async () => {
            if (!resolvedPath) return;
            try {
              await revealItemInDir(resolvedPath);
            } catch {
              toast.error(t("terminal:titleMenu.revealFailed"));
            }
          },
        },
        {
          id: "copy-path",
          section: "workingDirectory",
          label: t("commandPalette:commands.copyPath"),
          disabled: !path,
          keywords: ["copy", "path", "cwd"],
          run: async () => {
            if (!path) return;
            await navigator.clipboard.writeText(path);
          },
        },
        {
          id: "find",
          section: "view",
          label: t("commandPalette:commands.find"),
          shortcut: "⌘F",
          keywords: ["search", "find"],
          run: () => openSearch("tab"),
        },
        {
          id: "find-all",
          section: "view",
          label: t("commandPalette:commands.findInAllTabs"),
          shortcut: "⇧⌘F",
          keywords: ["search", "find", "all"],
          run: () => openSearch("all"),
        },
        {
          id: "jump-outline",
          section: "view",
          label: t("commandPalette:commands.jumpToOutline"),
          shortcut: "⌘J",
          keywords: ["jump", "outline"],
          run: () => {
            showSecondPanelView("outline");
            window.dispatchEvent(new CustomEvent("puck:focus-outline"));
          },
        },
      );
    }

    return commands;
  }, [
    openSearch,
    path,
    primaryPanelOpen,
    resolvedPath,
    secondPanelOpen,
    secondPanelView,
    setPage,
    showSecondPanelView,
    t,
    terminalActive,
    togglePrimaryPanel,
    toggleSecondPanel,
  ]);

  const openInCommands = useMemo<PaletteCommand[]>(() => {
    if (!resolvedPath) {
      return [];
    }

    return OPEN_IN_APPS.map((app) => ({
      id: `open-in-${app.id}`,
      section: "openIn" as const,
      label: t(app.labelKey),
      keywords: [app.id, "open"],
      run: async () => {
        try {
          await openPathInApp(resolvedPath, app.id);
        } catch {
          toast.error(t("terminal:titleMenu.openInFailed"));
        }
      },
    }));
  }, [resolvedPath, t]);

  const visibleCommands = useMemo(() => {
    const source = page === "open-in" ? openInCommands : rootCommands;
    return source.filter((command) => matchesQuery(command, query));
  }, [openInCommands, page, query, rootCommands]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<CommandSection, PaletteCommand[]>();
    for (const command of visibleCommands) {
      const list = groups.get(command.section) ?? [];
      list.push(command);
      groups.set(command.section, list);
    }
    return groups;
  }, [visibleCommands]);

  const flatCommands = visibleCommands;

  const executeCommand = useCallback(
    async (command: PaletteCommand) => {
      if (command.disabled) {
        return;
      }

      await command.run();
      if (!command.hasSubmenu) {
        closePalette();
      }
    },
    [closePalette],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, page]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, page]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (page === "open-in") {
          setPage("root");
          setQuery("");
          return;
        }
        closePalette();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, flatCommands.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }

      if (event.key === "Enter" && flatCommands[activeIndex]) {
        event.preventDefault();
        void executeCommand(flatCommands[activeIndex]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, closePalette, executeCommand, flatCommands, open, page, setPage]);

  useEffect(() => {
    const node = listRef.current?.querySelector("[data-active='true']");
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) {
    return null;
  }

  const sectionOrder: CommandSection[] =
    page === "open-in"
      ? ["openIn"]
      : terminalActive
        ? ["workingDirectory", "view"]
        : ["view"];

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 pt-[12vh] backdrop-blur-[2px]">
      <button
        type="button"
        aria-label={t("terminal:titleMenu.closeSearch")}
        className="absolute inset-0"
        onClick={closePalette}
      />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("commandPalette:searchPlaceholder")}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div ref={listRef} className="max-h-[min(60vh,24rem)] overflow-y-auto p-1.5">
          {flatCommands.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("common:empty.noSearchResults")}
            </p>
          ) : (
            sectionOrder.map((section) => {
              const commands = groupedCommands.get(section);
              if (!commands?.length) {
                return null;
              }

              return (
                <section key={section} className="pb-1">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      {t(`commandPalette:sections.${section}`)}
                    </p>
                    {section === "workingDirectory" && path ? (
                      <div className="flex max-w-[55%] items-center gap-1 text-[10px] text-muted-foreground">
                        <FolderIcon className="size-3 shrink-0" />
                        <span className="truncate font-mono">{path}</span>
                      </div>
                    ) : null}
                  </div>
                  {commands.map((command) => {
                    itemIndex += 1;
                    const index = itemIndex;
                    return (
                      <CommandPaletteItem
                        key={command.id}
                        command={command}
                        active={index === activeIndex}
                        onHover={() => setActiveIndex(index)}
                        onSelect={() => void executeCommand(command)}
                      />
                    );
                  })}
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CopyIcon,
  FolderOpenIcon,
  FolderSearchIcon,
  GitBranchIcon,
  InfoIcon,
  ListTreeIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PlugZapIcon,
  PlusIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  SquareTerminalIcon,
  UploadIcon,
  ZapIcon,
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { openPathInApp } from "@/lib/open-in-app";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { openProfileSession } from "@/lib/open-profile-session";
import { getSessionPathDisplay } from "@/lib/session-display";
import { isTauri } from "@/lib/platform";
import { listShells } from "@/lib/tauri-terminal";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";
import type { ConnectionProfile } from "@/types/connection";
import type { ShellInfo } from "@/types/shell";
import type { SecondPanelView } from "@/types/shell-ui";
import { toast } from "sonner";
import {
  OPEN_IN_APPS,
  PALETTE_PREFIXES,
  matchesPaletteQuery,
  parsePalettePrefix,
  type CommandSection,
  type PaletteCommand,
  type PalettePrefixId,
} from "@/components/command-palette/types";

function openLocalDefaultTerminal() {
  const { addSession } = useSessionStore.getState();
  useShellUiStore.getState().showSessionPanel();
  addSession({
    kind: "terminal",
    title: "__local__",
    protocol: "local",
  });
}

function openLocalShellTerminal(shell: ShellInfo) {
  const { addSession } = useSessionStore.getState();
  useShellUiStore.getState().showSessionPanel();
  addSession({
    kind: "terminal",
    title: shell.name,
    protocol: "local",
    shellId: shell.id,
    shellName: shell.kind,
  });
}

function openSavedConnection(profile: ConnectionProfile) {
  void openProfileSession(profile);
}

function profileConnectLabel(profile: ConnectionProfile): string {
  const user = profile.username || "user";
  const host = profile.host || "host";
  const port = profile.port ? `:${profile.port}` : "";
  return `${profile.name} — ${user}@${host}${port}`;
}

function filterCommands(commands: PaletteCommand[], filter: string) {
  const normalized = filter.trim().toLowerCase();
  if (!normalized) return commands;
  return commands.filter((command) => matchesPaletteQuery(command, normalized));
}

/**
 * Builds the filtered, grouped command list for the current palette prefix scope.
 */
export function usePaletteCommands(query: string): {
  activePrefix: PalettePrefixId | null;
  sectionOrder: CommandSection[];
  groupedCommands: Map<CommandSection, PaletteCommand[]>;
  flatCommands: PaletteCommand[];
  path: string | null;
} {
  const { t } = useTranslation(["commandPalette", "terminal"]);
  const open = useCommandPaletteStore((state) => state.open);

  const profiles = useConnectionStore((state) => state.profiles);

  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  const primaryPanelOpen = useShellUiStore((state) => state.primaryPanelOpen);
  const secondPanelOpen = useShellUiStore((state) => state.secondPanelOpen);
  const secondPanelView = useShellUiStore((state) => state.secondPanelView);
  const primaryPanelTab = useShellUiStore((state) => state.primaryPanelTab);
  const togglePrimaryPanel = useShellUiStore((state) => state.togglePrimaryPanel);
  const toggleSecondPanel = useShellUiStore((state) => state.toggleSecondPanel);
  const showSecondPanelView = useShellUiStore((state) => state.showSecondPanelView);
  const showSessionPanel = useShellUiStore((state) => state.showSessionPanel);
  const setPrimaryPanelTab = useShellUiStore((state) => state.setPrimaryPanelTab);
  const openHostEditor = useShellUiStore((state) => state.openHostEditor);
  const openSearch = useTerminalSearchStore((state) => state.openSearch);

  const [shells, setShells] = useState<ShellInfo[]>([]);

  useEffect(() => {
    if (!open) return;
    void listShells()
      .then(setShells)
      .catch(() => setShells([]));
  }, [open]);

  const path =
    activeSession?.kind === "terminal"
      ? getSessionPathDisplay(activeSession)
      : null;
  const resolvedPath = activeSession?.cwd ?? path ?? null;
  const terminalActive = activeSession?.kind === "terminal";

  const scopeCommands = useMemo<PaletteCommand[]>(() => {
    return PALETTE_PREFIXES.filter((prefix) => {
      if (prefix.id === "cwd" || prefix.id === "open") {
        return terminalActive && Boolean(resolvedPath);
      }
      return true;
    }).map((prefix) => ({
      id: `scope-${prefix.id}`,
      section: "scopes" as const,
      label: t(prefix.labelKey),
      icon: prefix.id === "connect" ? PlugZapIcon : prefix.id === "view" ? PanelRightIcon : prefix.id === "cwd" ? FolderOpenIcon : prefix.id === "open" ? FolderSearchIcon : ZapIcon,
      keywords: [...prefix.aliases, prefix.id],
      prefixTarget: prefix.id,
      run: () => {},
    }));
  }, [resolvedPath, t, terminalActive]);

  const connectCommands = useMemo<PaletteCommand[]>(() => {
    const localCommands: PaletteCommand[] = [
      {
        id: "connect-local-default",
        section: "terminal",
        label: t("terminal:localDefault"),
        icon: SquareTerminalIcon,
        keywords: ["local", "default", "terminal", "本地", "默认"],
        run: () => openLocalDefaultTerminal(),
      },
      ...shells.map((shell) => ({
        id: `connect-shell-${shell.id}`,
        section: "terminal" as const,
        label: shell.name,
        icon: SquareTerminalIcon,
        keywords: [shell.kind, shell.name, "local", "shell"],
        run: () => openLocalShellTerminal(shell),
      })),
    ];

    const remoteCommands = profiles
      .filter((profile) => profile.protocol !== "local" && !profile.ephemeral)
      .map((profile) => ({
        id: `connect-${profile.id}`,
        section: "connections" as const,
        label: profileConnectLabel(profile),
        icon: ServerIcon,
        keywords: [
          "connect",
          "remote",
          "连接",
          profile.name,
          profile.host ?? "",
          profile.username ?? "",
          profile.protocol,
        ],
        run: () => {
          openSavedConnection(profile);
        },
      }));

    return [...localCommands, ...remoteCommands];
  }, [profiles, shells, t]);

  const viewCommands = useMemo<PaletteCommand[]>(() => {
    const viewDetail = (view: SecondPanelView, label: string, icon: PaletteCommand["icon"]) => ({
      id: `view-details-${view}`,
      section: "view" as const,
      label,
      icon,
      checked: secondPanelOpen && secondPanelView === view,
      keywords: [view, "details", "view"],
      run: () => showSecondPanelView(view),
    });

    const commands: PaletteCommand[] = [
      {
        id: "view-toggle-tabs",
        section: "view",
        label: t("commandPalette:commands.toggleTabsPanel"),
        icon: PanelLeftIcon,
        shortcut: "⇧⌘L",
        checked: primaryPanelOpen,
        keywords: ["tabs", "sidebar", "primary", "view"],
        run: () => togglePrimaryPanel(),
      },
      {
        id: "view-toggle-details",
        section: "view",
        label: t("commandPalette:commands.toggleDetailsPanel"),
        icon: PanelRightIcon,
        shortcut: "⇧⌘R",
        checked: secondPanelOpen,
        keywords: ["details", "second", "right", "view"],
        run: () => toggleSecondPanel(),
      },
      viewDetail("info", t("commandPalette:commands.detailsInfo"), InfoIcon),
      viewDetail("outline", t("commandPalette:commands.detailsOutline"), ListTreeIcon),
      viewDetail("files", t("commandPalette:commands.detailsFiles"), FolderOpenIcon),
      viewDetail("git", t("commandPalette:commands.detailsGit"), GitBranchIcon),
      viewDetail("transfers", t("commandPalette:commands.detailsTransfers"), UploadIcon),
      {
        id: "view-sessions-tab",
        section: "view",
        label: t("commandPalette:commands.showSessionsTab"),
        icon: SquareTerminalIcon,
        checked: primaryPanelTab === "sessions",
        keywords: ["sessions", "tabs", "会话", "view"],
        run: () => showSessionPanel(),
      },
      {
        id: "view-hosts-tab",
        section: "view",
        label: t("commandPalette:commands.showHostsTab"),
        icon: ServerIcon,
        checked: primaryPanelTab === "hosts",
        keywords: ["hosts", "remote", "远程主机", "view"],
        run: () => setPrimaryPanelTab("hosts"),
      },
      {
        id: "view-settings",
        section: "view",
        label: t("commandPalette:commands.openSettings"),
        icon: SettingsIcon,
        shortcut: "⌘,",
        keywords: ["settings", "preferences", "view"],
        run: () => void openSettingsWindow(),
      },
    ];

    if (terminalActive) {
      commands.push(
        {
          id: "view-find",
          section: "view",
          label: t("commandPalette:commands.find"),
          icon: SearchIcon,
          shortcut: "⌘F",
          keywords: ["search", "find", "view"],
          run: () => openSearch("tab"),
        },
        {
          id: "view-find-all",
          section: "view",
          label: t("commandPalette:commands.findInAllTabs"),
          icon: SearchIcon,
          shortcut: "⇧⌘F",
          keywords: ["search", "find", "all", "view"],
          run: () => openSearch("all"),
        },
        {
          id: "view-jump-outline",
          section: "view",
          label: t("commandPalette:commands.jumpToOutline"),
          icon: ListTreeIcon,
          shortcut: "⌘J",
          keywords: ["jump", "outline", "view"],
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
    primaryPanelTab,
    primaryPanelOpen,
    secondPanelOpen,
    secondPanelView,
    setPrimaryPanelTab,
    showSessionPanel,
    showSecondPanelView,
    t,
    terminalActive,
    togglePrimaryPanel,
    toggleSecondPanel,
  ]);

  const cwdCommands = useMemo<PaletteCommand[]>(() => {
    if (!terminalActive) return [];

    return [
      {
        id: "cwd-reveal",
        section: "workingDirectory",
        label: t("commandPalette:commands.revealInFinder"),
        icon: FolderSearchIcon,
        disabled: !resolvedPath || !isTauri(),
        keywords: ["finder", "reveal", "cwd", "dir"],
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
        id: "cwd-copy-path",
        section: "workingDirectory",
        label: t("commandPalette:commands.copyPath"),
        icon: CopyIcon,
        disabled: !path,
        keywords: ["copy", "path", "cwd", "dir"],
        run: async () => {
          if (!path) return;
          await navigator.clipboard.writeText(path);
        },
      },
      {
        id: "cwd-open-prefix",
        section: "workingDirectory",
        label: t("commandPalette:commands.openIn"),
        icon: FolderOpenIcon,
        disabled: !resolvedPath,
        keywords: ["open", "editor", "finder", "cwd"],
        prefixTarget: "open",
        run: () => {},
      },
    ];
  }, [path, resolvedPath, t, terminalActive]);

  const openCommands = useMemo<PaletteCommand[]>(() => {
    if (!resolvedPath) return [];

    return OPEN_IN_APPS.map((app) => ({
      id: `open-in-${app.id}`,
      section: "openIn" as const,
      label: t(app.labelKey),
      icon: FolderOpenIcon,
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

  const actionCommands = useMemo<PaletteCommand[]>(() => {
    return [
      {
        id: "action-new-terminal",
        section: "actions",
        label: t("commandPalette:commands.newLocalTerminal"),
        icon: SquareTerminalIcon,
        keywords: ["terminal", "local", "new", "终端", "本地", "action"],
        run: () => openLocalDefaultTerminal(),
      },
      {
        id: "action-connect",
        section: "actions",
        label: t("commandPalette:commands.pickTerminal"),
        icon: PlugZapIcon,
        keywords: ["terminal", "shell", "connect", "连接", "action"],
        prefixTarget: "connect",
        run: () => {},
      },
      {
        id: "action-quick-connect",
        section: "actions",
        label: t("commandPalette:commands.quickConnect"),
        icon: ZapIcon,
        keywords: ["quick", "connect", "ssh", "快速连接", "action"],
        run: () => {
          window.dispatchEvent(new CustomEvent("puck:quick-connect"));
        },
      },
      {
        id: "action-new-connection",
        section: "actions",
        label: t("commandPalette:commands.newConnection"),
        icon: PlusIcon,
        keywords: ["connection", "host", "remote", "新建连接", "action"],
        run: () => openHostEditor(null),
      },
    ];
  }, [openHostEditor, t]);

  const commandsByPrefix = useMemo(
    () =>
      ({
        connect: connectCommands,
        view: viewCommands,
        cwd: cwdCommands,
        open: openCommands,
        action: actionCommands,
      }) satisfies Record<PalettePrefixId, PaletteCommand[]>,
    [actionCommands, connectCommands, cwdCommands, openCommands, viewCommands],
  );

  const parsed = parsePalettePrefix(query);

  const flatCommands = useMemo(() => {
    if (parsed.active && parsed.prefix) {
      return filterCommands(commandsByPrefix[parsed.prefix], parsed.filter);
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return scopeCommands;
    }

    return scopeCommands.filter((command) => matchesPaletteQuery(command, normalized));
  }, [commandsByPrefix, parsed.active, parsed.filter, parsed.prefix, query, scopeCommands]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<CommandSection, PaletteCommand[]>();
    for (const command of flatCommands) {
      const list = groups.get(command.section) ?? [];
      list.push(command);
      groups.set(command.section, list);
    }
    return groups;
  }, [flatCommands]);

  const sectionOrder = useMemo<CommandSection[]>(() => {
    if (!parsed.active) {
      return flatCommands.length > 0 ? ["scopes"] : ["scopes"];
    }

    const sections: CommandSection[] = [];
    const order: CommandSection[] = [
      "terminal",
      "connections",
      "actions",
      "workingDirectory",
      "openIn",
      "view",
    ];

    for (const section of order) {
      if (flatCommands.some((command) => command.section === section)) {
        sections.push(section);
      }
    }

    return sections.length > 0 ? sections : ["scopes"];
  }, [flatCommands, parsed.active]);

  return {
    activePrefix: parsed.prefix,
    sectionOrder,
    groupedCommands,
    flatCommands,
    path,
  };
}

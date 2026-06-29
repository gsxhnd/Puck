import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  matchesPaletteQuery,
  parseConnectPrefix,
  type CommandSection,
  type PaletteCommand,
  type PalettePage,
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

/**
 * Builds the filtered, grouped command list for the current palette page.
 *
 * 根据当前面板页（根页或「用…打开」子页）、搜索关键词以及活动终端会话，
 * 组装命令面板可执行的命令列表，并按区段分组供 UI 渲染。
 */
export function usePaletteCommands(
  page: PalettePage,
  query: string,
): {
  sectionOrder: CommandSection[];
  groupedCommands: Map<CommandSection, PaletteCommand[]>;
  flatCommands: PaletteCommand[];
  path: string | null;
} {
  const { t } = useTranslation(["commandPalette", "terminal"]);
  const open = useCommandPaletteStore((state) => state.open);
  const setPage = useCommandPaletteStore((state) => state.setPage);
  const setDraftQuery = useCommandPaletteStore((state) => state.setDraftQuery);

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
      {
        id: "browse-connections",
        section: "view",
        label: t("commandPalette:commands.browseConnections"),
        hasSubmenu: true,
        keywords: ["connect", "ssh", "remote", "host", "连接", "主机", "远程"],
        run: () => setDraftQuery("connect "),
      },
      {
        id: "new-terminal-default",
        section: "actions",
        label: t("commandPalette:commands.newLocalTerminal"),
        keywords: ["terminal", "local", "new", "终端", "本地"],
        run: () => openLocalDefaultTerminal(),
      },
      {
        id: "pick-terminal",
        section: "actions",
        label: t("commandPalette:commands.pickTerminal"),
        hasSubmenu: true,
        keywords: ["terminal", "shell", "wsl", "powershell", "cmd", "终端"],
        run: () => setPage("new-terminal"),
      },
      {
        id: "quick-connect",
        section: "actions",
        label: t("commandPalette:commands.quickConnect"),
        keywords: ["quick", "connect", "ssh", "快速连接"],
        run: () => {
          window.dispatchEvent(new CustomEvent("puck:quick-connect"));
        },
      },
      {
        id: "new-connection",
        section: "actions",
        label: t("commandPalette:commands.newConnection"),
        keywords: ["connection", "host", "remote", "新建连接"],
        run: () => openHostEditor(null),
      },
      {
        id: "show-sessions-tab",
        section: "view",
        label: t("commandPalette:commands.showSessionsTab"),
        checked: primaryPanelTab === "sessions",
        keywords: ["sessions", "tabs", "会话"],
        run: () => showSessionPanel(),
      },
      {
        id: "show-hosts-tab",
        section: "view",
        label: t("commandPalette:commands.showHostsTab"),
        checked: primaryPanelTab === "hosts",
        keywords: ["hosts", "remote", "远程主机"],
        run: () => setPrimaryPanelTab("hosts"),
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
    openHostEditor,
    path,
    primaryPanelTab,
    primaryPanelOpen,
    resolvedPath,
    secondPanelOpen,
    secondPanelView,
    setPage,
    setDraftQuery,
    setPrimaryPanelTab,
    showSessionPanel,
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

  const connectCommands = useMemo<PaletteCommand[]>(() => {
    return profiles
      .filter((profile) => profile.protocol !== "local" && !profile.ephemeral)
      .map((profile) => ({
        id: `connect-${profile.id}`,
        section: "connections" as const,
        label: profileConnectLabel(profile),
        keywords: [
          "connect",
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
  }, [profiles]);

  const newTerminalCommands = useMemo<PaletteCommand[]>(() => {
    const localCommands: PaletteCommand[] = [
      {
        id: "new-terminal-default",
        section: "terminal",
        label: t("terminal:localDefault"),
        keywords: ["local", "default", "terminal", "本地", "默认"],
        run: () => openLocalDefaultTerminal(),
      },
      ...shells.map((shell) => ({
        id: `shell-${shell.id}`,
        section: "terminal" as const,
        label: shell.name,
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

  const connectPrefix = parseConnectPrefix(query);
  const flatCommands = useMemo(() => {
    if (page === "new-terminal") {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return newTerminalCommands;
      return newTerminalCommands.filter((command) =>
        matchesPaletteQuery(command, normalized),
      );
    }

    if (page === "open-in") {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return openInCommands;
      return openInCommands.filter((command) =>
        matchesPaletteQuery(command, normalized),
      );
    }

    const filterConnectCommands = (filter: string) => {
      if (!filter) return connectCommands;
      return connectCommands.filter((command) =>
        matchesPaletteQuery(command, filter),
      );
    };

    if (connectPrefix.active) {
      return filterConnectCommands(connectPrefix.filter);
    }

    const normalized = query.trim();
    if (!normalized) return rootCommands;

    const matchedConnections = connectCommands.filter((command) =>
      matchesPaletteQuery(command, normalized),
    );
    const matchedRoot = rootCommands.filter((command) =>
      matchesPaletteQuery(command, normalized),
    );

    return [...matchedConnections, ...matchedRoot];
  }, [
    connectCommands,
    connectPrefix.active,
    connectPrefix.filter,
    newTerminalCommands,
    openInCommands,
    page,
    query,
    rootCommands,
  ]);

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
    if (page === "open-in") {
      return ["openIn"];
    }

    if (page === "new-terminal") {
      const sections: CommandSection[] = [];
      if (flatCommands.some((command) => command.section === "terminal")) {
        sections.push("terminal");
      }
      if (flatCommands.some((command) => command.section === "connections")) {
        sections.push("connections");
      }
      return sections.length > 0 ? sections : ["terminal"];
    }

    const sections: CommandSection[] = [];
    if (flatCommands.some((command) => command.section === "connections")) {
      sections.push("connections");
    }
    if (flatCommands.some((command) => command.section === "actions")) {
      sections.push("actions");
    }
    if (flatCommands.some((command) => command.section === "workingDirectory")) {
      sections.push("workingDirectory");
    }
    if (flatCommands.some((command) => command.section === "view")) {
      sections.push("view");
    }

    return sections.length > 0 ? sections : ["view"];
  }, [flatCommands, page]);

  return { sectionOrder, groupedCommands, flatCommands, path };
}

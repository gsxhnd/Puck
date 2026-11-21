/**
 * Workspace-scoped command palette commands.
 *
 * 以 Workspace 为中心的命令面板：连接打开 Workspace，视图切换 Files / Git /
 * Ports 与终端，路径命令作用于 Workspace root，而不是某个终端的临时 cwd。
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CableIcon,
  CopyIcon,
  FilePlusIcon,
  FolderOpenIcon,
  FolderSearchIcon,
  GitBranchIcon,
  PanelLeftIcon,
  PlugZapIcon,
  PlusIcon,
  RotateCwIcon,
  SaveIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  SquareTerminalIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openPathInApp } from "@/lib/open-in-app";
import { openFileInWorkbench } from "@/lib/open-in-workbench";
import {
  closeActiveTab,
  saveActiveEditorTab,
} from "@/lib/workbench-editor-actions";
import { reloadAppWindow } from "@/lib/reload-app-window";
import { openSettingsWindow } from "@/lib/open-settings-window";
import { openConnectionsWindow } from "@/lib/open-connections-window";
import { openProfileSession } from "@/lib/open-profile-session";
import {
  chooseLocalWorkspace,
  createWorkspaceTerminal,
} from "@/lib/workspace-actions";
import { isTauri } from "@/lib/platform";
import { listShells } from "@/lib/tauri-terminal";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useConnectionStore } from "@/stores/connection-store";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";
import { useWorkbenchStore } from "@/stores/workbench-store";
import {
  useWorkspaceStore,
  type WorkspaceSidebarView,
} from "@/stores/workspace-store";
import type { ConnectionProfile } from "@/types/connection";
import type { ShellInfo } from "@/types/shell";
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

function filterCommands(commands: PaletteCommand[], filter: string) {
  const normalized = filter.trim().toLowerCase();
  if (!normalized) return commands;
  return commands.filter((command) => matchesPaletteQuery(command, normalized));
}

function profileConnectLabel(profile: ConnectionProfile): string {
  const user = profile.username || "user";
  const host = profile.host || "host";
  const port = profile.port ? `:${profile.port}` : "";
  return `${profile.name} — ${user}@${host}${port}`;
}

/**
 * Builds the filtered, grouped command list for the current palette query.
 */
export function usePaletteCommands(query: string): {
  activePrefix: PalettePrefixId | null;
  sectionOrder: CommandSection[];
  groupedCommands: Map<CommandSection, PaletteCommand[]>;
  flatCommands: PaletteCommand[];
  path: string | null;
} {
  const { t } = useTranslation(["common", "commandPalette", "terminal"]);
  const open = useCommandPaletteStore((state) => state.open);
  const profiles = useConnectionStore((state) => state.profiles);
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen);
  const sidebarView = useWorkspaceStore((state) => state.sidebarView);
  const terminalOpen = useWorkspaceStore((state) => state.terminalOpen);
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);
  const toggleTerminal = useWorkspaceStore((state) => state.toggleTerminal);
  const setSidebarView = useWorkspaceStore((state) => state.setSidebarView);
  const openSearch = useTerminalSearchStore((state) => state.openSearch);
  const hasActiveEditorTab = useWorkbenchStore(
    (state) => state.activeTabId !== null,
  );
  const [shells, setShells] = useState<ShellInfo[]>([]);

  useEffect(() => {
    if (!open) return;
    void listShells()
      .then(setShells)
      .catch(() => setShells([]));
  }, [open]);

  const path = workspace?.rootPath ?? null;
  const isLocalWorkspace = workspace?.source === "local";

  const scopeCommands = useMemo<PaletteCommand[]>(() => {
    return PALETTE_PREFIXES.filter((prefix) => {
      if (prefix.id === "cwd" || prefix.id === "open") return Boolean(path);
      return true;
    }).map((prefix) => ({
      id: `scope-${prefix.id}`,
      section: "scopes" as const,
      label: t(prefix.labelKey),
      icon: prefix.id === "connect"
        ? PlugZapIcon
        : prefix.id === "view"
          ? PanelLeftIcon
          : prefix.id === "cwd"
            ? FolderOpenIcon
            : prefix.id === "open"
              ? FolderSearchIcon
              : ZapIcon,
      keywords: [...prefix.aliases, prefix.id],
      prefixTarget: prefix.id,
      run: () => {},
    }));
  }, [path, t]);

  const connectCommands = useMemo<PaletteCommand[]>(() => {
    const canCreateLocalTerminal = workspace?.source !== "remote";
    const localCommands: PaletteCommand[] = canCreateLocalTerminal
      ? [
          {
            id: "connect-local-default",
            section: "terminal",
            label: t("terminal:localDefault"),
            icon: SquareTerminalIcon,
            keywords: ["local", "default", "terminal", "本地", "默认"],
            run: () => void createWorkspaceTerminal(),
          },
          ...shells.map((shell) => ({
            id: `connect-shell-${shell.id}`,
            section: "terminal" as const,
            label: shell.name,
            icon: SquareTerminalIcon,
            keywords: [shell.kind, shell.name, "local", "shell"],
            run: () => void createWorkspaceTerminal(shell),
          })),
        ]
      : [];

    const remoteCommands = profiles
      .filter((profile) => !profile.ephemeral)
      .map((profile) => ({
        id: `connect-${profile.id}`,
        section: "connections" as const,
        label: profileConnectLabel(profile),
        icon: ServerIcon,
        keywords: [
          "connect",
          "remote",
          "workspace",
          "连接",
          profile.name,
          profile.host ?? "",
          profile.username ?? "",
          profile.protocol,
        ],
        run: () => {
          void openProfileSession(profile);
        },
      }));

    return [...localCommands, ...remoteCommands];
  }, [profiles, shells, t, workspace?.source]);

  const viewCommands = useMemo<PaletteCommand[]>(() => {
    const showView = (
      view: WorkspaceSidebarView,
      label: string,
      icon: PaletteCommand["icon"],
    ): PaletteCommand => ({
      id: `view-sidebar-${view}`,
      section: "view",
      label,
      icon,
      checked: sidebarOpen && sidebarView === view,
      keywords: [view, "workspace", "sidebar"],
      run: () => setSidebarView(view),
    });

    const commands: PaletteCommand[] = [
      {
        id: "view-toggle-sidebar",
        section: "view",
        label: t("common:workspace.toggleSidebar"),
        icon: PanelLeftIcon,
        shortcut: "⌘B",
        checked: sidebarOpen,
        keywords: ["sidebar", "panel", "侧栏", "view"],
        run: () => toggleSidebar(),
      },
      showView("explorer", t("common:workspace.explorer"), FolderOpenIcon),
      showView("git", t("common:workspace.git"), GitBranchIcon),
      showView("ports", t("common:workspace.ports"), CableIcon),
      {
        id: "view-toggle-terminal",
        section: "view",
        label: terminalOpen
          ? t("common:workspace.hideTerminal")
          : t("common:workspace.showTerminal"),
        icon: SquareTerminalIcon,
        shortcut: "⌘J",
        checked: terminalOpen,
        keywords: ["terminal", "bottom", "panel", "终端", "view"],
        run: () => toggleTerminal(),
      },
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
        id: "view-settings",
        section: "view",
        label: t("commandPalette:commands.openSettings"),
        icon: SettingsIcon,
        shortcut: "⌘,",
        keywords: ["settings", "preferences", "view"],
        run: () => void openSettingsWindow(),
      },
    ];

    return commands;
  }, [
    openSearch,
    setSidebarView,
    sidebarOpen,
    sidebarView,
    t,
    terminalOpen,
    toggleSidebar,
    toggleTerminal,
  ]);

  const cwdCommands = useMemo<PaletteCommand[]>(() => {
    if (!workspace || !path) return [];

    return [
      {
        id: "cwd-copy-path",
        section: "workingDirectory",
        label: t("commandPalette:commands.copyPath"),
        icon: CopyIcon,
        keywords: ["copy", "path", "workspace", "dir"],
        run: async () => {
          await navigator.clipboard.writeText(path);
        },
      },
      {
        id: "cwd-reveal",
        section: "workingDirectory",
        label: t("commandPalette:commands.revealInFinder"),
        icon: FolderSearchIcon,
        disabled: !isLocalWorkspace || !isTauri(),
        keywords: ["finder", "reveal", "workspace", "dir"],
        run: async () => {
          if (!isLocalWorkspace) return;
          try {
            await revealItemInDir(path);
          } catch {
            toast.error(t("terminal:titleMenu.revealFailed"));
          }
        },
      },
      {
        id: "cwd-open-prefix",
        section: "workingDirectory",
        label: t("commandPalette:commands.openIn"),
        icon: FolderOpenIcon,
        disabled: !isLocalWorkspace,
        keywords: ["open", "editor", "finder", "workspace"],
        prefixTarget: "open",
        run: () => {},
      },
    ];
  }, [isLocalWorkspace, path, t, workspace]);

  const openCommands = useMemo<PaletteCommand[]>(() => {
    if (!path || !isLocalWorkspace) return [];

    return OPEN_IN_APPS.map((app) => ({
      id: `open-in-${app.id}`,
      section: "openIn" as const,
      label: t(app.labelKey),
      icon: FolderOpenIcon,
      keywords: [app.id, "open"],
      run: async () => {
        try {
          await openPathInApp(path, app.id);
        } catch {
          toast.error(t("terminal:titleMenu.openInFailed"));
        }
      },
    }));
  }, [isLocalWorkspace, path, t]);

  const actionCommands = useMemo<PaletteCommand[]>(() => {
    return [
      {
        id: "action-reload-window",
        section: "actions",
        label: t("commandPalette:commands.reloadWindow"),
        icon: RotateCwIcon,
        keywords: ["reload", "refresh", "window", "重新加载", "刷新", "action"],
        run: () => reloadAppWindow(),
      },
      {
        id: "action-open-workspace",
        section: "actions",
        label: t("common:workspace.openLocal"),
        icon: FolderOpenIcon,
        keywords: ["open", "workspace", "folder", "打开", "目录", "action"],
        run: () => void chooseLocalWorkspace(),
      },
      {
        id: "action-new-terminal",
        section: "actions",
        label: t("commandPalette:commands.newLocalTerminal"),
        icon: SquareTerminalIcon,
        keywords: ["terminal", "new", "workspace", "终端", "action"],
        run: () => void createWorkspaceTerminal(),
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
        run: () => void openConnectionsWindow(),
      },
      {
        id: "action-new-connection",
        section: "actions",
        label: t("commandPalette:commands.newConnection"),
        icon: PlusIcon,
        keywords: ["connection", "host", "remote", "新建连接", "action"],
        run: () => void openConnectionsWindow(),
      },
      {
        id: "action-open-file",
        section: "actions",
        label: t("commandPalette:commands.openFile"),
        icon: FilePlusIcon,
        disabled: !isTauri(),
        keywords: ["open", "file", "editor", "打开", "文件", "action"],
        run: async () => {
          const result = await openFileDialog({
            multiple: false,
            directory: false,
          });
          if (typeof result === "string") {
            openFileInWorkbench({ path: result, source: "local" });
          }
        },
      },
      {
        id: "action-save-editor-tab",
        section: "actions",
        label: t("commandPalette:commands.saveEditorTab"),
        icon: SaveIcon,
        shortcut: "⌘S",
        disabled: !hasActiveEditorTab,
        keywords: ["save", "editor", "tab", "保存", "action"],
        run: () => void saveActiveEditorTab(),
      },
      {
        id: "action-close-editor-tab",
        section: "actions",
        label: t("commandPalette:commands.closeEditorTab"),
        icon: XIcon,
        disabled: !hasActiveEditorTab,
        keywords: ["close", "editor", "tab", "关闭", "action"],
        run: () => closeActiveTab(),
      },
    ];
  }, [hasActiveEditorTab, t]);

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

    return scopeCommands.filter((command) =>
      matchesPaletteQuery(command, normalized),
    );
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
      return ["scopes"];
    }

    const order: CommandSection[] = [
      "terminal",
      "connections",
      "actions",
      "workingDirectory",
      "openIn",
      "view",
    ];
    return order.filter((section) =>
      flatCommands.some((command) => command.section === section),
    );
  }, [flatCommands, parsed.active]);

  return {
    activePrefix: parsed.prefix,
    sectionOrder,
    groupedCommands,
    flatCommands,
    path,
  };
}

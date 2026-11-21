/**
 * Active local/remote workspace and workbench layout state.
 *
 * 当前本地或远程工作区及其布局状态。Workspace 是文件树、编辑器、终端、Git
 * 和端口转发的共同上下文；运行中的终端与文档仍由各自 store 管理。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  PUCK_CONFIG_KEYS,
  puckPersistStorage,
} from "@/lib/puck-config-storage";
import type { ConnectionProfile } from "@/types/connection";

export type WorkspaceSource = "local" | "remote";

export type Workspace = {
  id: string;
  source: WorkspaceSource;
  name: string;
  rootPath: string;
  profileId?: string;
};

export type WorkspaceSidebarView = "explorer" | "git" | "ports";
export type RemoteWorkspaceStatus = "disconnected" | "connecting" | "connected" | "failed";

type WorkspaceStore = {
  activeWorkspace: Workspace | null;
  recentWorkspaces: Workspace[];
  sidebarView: WorkspaceSidebarView;
  sidebarOpen: boolean;
  terminalOpen: boolean;
  remoteStatus: RemoteWorkspaceStatus;
  setRemoteStatus: (status: RemoteWorkspaceStatus) => void;
  openLocalWorkspace: (rootPath: string) => Workspace;
  openRemoteWorkspace: (profile: ConnectionProfile) => Workspace;
  activateWorkspace: (workspace: Workspace) => void;
  closeWorkspace: () => void;
  setSidebarView: (view: WorkspaceSidebarView) => void;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
};

function pathName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}

function rememberWorkspace(recents: Workspace[], workspace: Workspace): Workspace[] {
  return [workspace, ...recents.filter((item) => item.id !== workspace.id)].slice(0, 12);
}

export function localWorkspace(rootPath: string): Workspace {
  const normalized = rootPath.trim() || "~";
  return {
    id: `local:${normalized}`,
    source: "local",
    name: pathName(normalized) || normalized,
    rootPath: normalized,
  };
}

export function remoteWorkspace(profile: ConnectionProfile): Workspace {
  const rootPath = profile.defaultDirectory?.trim() || "/";
  return {
    id: `remote:${profile.id}:${rootPath}`,
    source: "remote",
    name: profile.name,
    rootPath,
    profileId: profile.id,
  };
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      activeWorkspace: null,
      recentWorkspaces: [],
      sidebarView: "explorer",
      sidebarOpen: true,
      terminalOpen: true,
      remoteStatus: "disconnected",
      setRemoteStatus: (remoteStatus) => set({ remoteStatus }),

      openLocalWorkspace: (rootPath) => {
        const workspace = localWorkspace(rootPath);
        set((state) => ({
          activeWorkspace: workspace,
          recentWorkspaces: rememberWorkspace(state.recentWorkspaces, workspace),
          sidebarView: "explorer",
          sidebarOpen: true,
        }));
        return workspace;
      },

      openRemoteWorkspace: (profile) => {
        const workspace = remoteWorkspace(profile);
        set((state) => ({
          activeWorkspace: workspace,
          recentWorkspaces: rememberWorkspace(state.recentWorkspaces, workspace),
          sidebarView: "explorer",
          sidebarOpen: true,
        }));
        return workspace;
      },

      activateWorkspace: (workspace) => {
        set((state) => ({
          activeWorkspace: workspace,
          recentWorkspaces: rememberWorkspace(state.recentWorkspaces, workspace),
        }));
      },

      closeWorkspace: () => set({ activeWorkspace: null }),
      setSidebarView: (sidebarView) => set({ sidebarView, sidebarOpen: true }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleTerminal: () => set((state) => ({ terminalOpen: !state.terminalOpen })),
      setTerminalOpen: (terminalOpen) => set({ terminalOpen }),
    }),
    {
      name: PUCK_CONFIG_KEYS.workspaces,
      storage: puckPersistStorage,
      skipHydration: true,
      partialize: (state) => ({
        activeWorkspace: state.activeWorkspace,
        recentWorkspaces: state.recentWorkspaces,
        sidebarView: state.sidebarView,
        sidebarOpen: state.sidebarOpen,
        terminalOpen: state.terminalOpen,
      }),
    },
  ),
);

/**
 * Commands for opening workspaces and creating workspace-owned terminals.
 *
 * 打开工作区及创建工作区终端的命令入口。所有新终端继承 Workspace 根目录与
 * workspaceId，终端后续 cd 不会反向修改 Workspace。
 */
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import i18n from "@/i18n";
import { isTauri } from "@/lib/platform";
import { parsePuckError } from "@/lib/puck-error";
import { prepareProfileConnection } from "@/lib/resolve-connection-credential";
import { profileTabLabel } from "@/lib/session-display";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import {
  localWorkspace,
  useWorkspaceStore,
  type Workspace,
} from "@/stores/workspace-store";
import type { ConnectionProfile } from "@/types/connection";
import type { ShellInfo } from "@/types/shell";

export async function chooseLocalWorkspace(): Promise<Workspace | null> {
  if (!isTauri()) {
    const fallback = localWorkspace("~");
    useWorkspaceStore.getState().activateWorkspace(fallback);
    return fallback;
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: i18n.t("common:workspace.openLocal"),
  });
  if (typeof selected !== "string") return null;
  return useWorkspaceStore.getState().openLocalWorkspace(selected);
}

export function openRemoteWorkspace(profile: ConnectionProfile): Workspace {
  return useWorkspaceStore.getState().openRemoteWorkspace(profile);
}

/**
 * Waits for the active remote workspace lease to reach a terminal state.
 *
 * 等待活动远程 Workspace 的基础 SSH 租约进入终态。连接成功返回 true；失败、
 * 取消或超时返回 false。用于避免 Workspace 与首个终端并发触发 Host Key。
 */
export function waitForRemoteWorkspaceReady(timeoutMs = 120_000): Promise<boolean> {
  const state = useWorkspaceStore.getState();
  if (state.activeWorkspace?.source !== "remote") return Promise.resolve(false);
  if (state.remoteStatus === "connected") return Promise.resolve(true);
  if (state.remoteStatus === "failed") return Promise.resolve(false);

  return new Promise((resolve) => {
    let timer: number | undefined;
    const finish = (ready: boolean) => {
      window.clearTimeout(timer);
      unsubscribe();
      resolve(ready);
    };
    const unsubscribe = useWorkspaceStore.subscribe((next) => {
      if (next.remoteStatus === "connected") finish(true);
      else if (next.remoteStatus === "failed") finish(false);
    });
    timer = window.setTimeout(() => finish(false), timeoutMs);
  });
}

export function activateRecentWorkspace(workspace: Workspace): boolean {
  if (workspace.source === "remote") {
    const profile = workspace.profileId
      ? useConnectionStore.getState().getProfile(workspace.profileId)
      : undefined;
    if (!profile) {
      toast.error(i18n.t("common:workspace.missingProfile"));
      return false;
    }
  }
  useWorkspaceStore.getState().activateWorkspace(workspace);
  return true;
}

/**
 * Toggles the terminal panel visibility.
 *
 * 切换终端面板。收起时直接隐藏；展开时若当前 Workspace 已有终端则聚焦最近
 * 一个，否则创建一个默认终端，保证面板展开后始终有可用内容。
 */
export function toggleTerminalPanel(): void {
  const workspaceState = useWorkspaceStore.getState();
  if (workspaceState.terminalOpen) {
    workspaceState.setTerminalOpen(false);
    return;
  }
  const workspace = workspaceState.activeWorkspace;
  const existing = useSessionStore
    .getState()
    .sessions.filter(
      (session) =>
        session.kind === "terminal" &&
        (workspace
          ? session.workspaceId === workspace.id
          : !session.workspaceId),
    );
  const last = existing[existing.length - 1];
  if (last) {
    workspaceState.setTerminalOpen(true);
    useSessionStore.getState().setActiveSession(last.id);
    return;
  }
  void createWorkspaceTerminal();
}

export async function createWorkspaceTerminal(
  shell?: Pick<ShellInfo, "id" | "name" | "kind">,
): Promise<void> {
  const workspaceState = useWorkspaceStore.getState();
  const workspace = workspaceState.activeWorkspace ?? workspaceState.openLocalWorkspace("~");
  workspaceState.setTerminalOpen(true);

  if (workspace.source === "local") {
    useSessionStore.getState().addSession({
      kind: "terminal",
      title: shell?.name ?? "__local__",
      protocol: "local",
      shellId: shell?.id,
      shellName: shell?.kind,
      cwd: workspace.rootPath,
      workspaceId: workspace.id,
    });
    return;
  }

  const profile = workspace.profileId
    ? useConnectionStore.getState().getProfile(workspace.profileId)
    : undefined;
  if (!profile) {
    toast.error(i18n.t("common:workspace.missingProfile"));
    return;
  }

  try {
    const ready = await prepareProfileConnection(profile);
    if (!ready) return;
    useSessionStore.getState().addSession({
      kind: "terminal",
      title: profile.name,
      profileId: profile.id,
      protocol: "ssh",
      shellName: "ssh",
      tabLabel: profileTabLabel(profile),
      status: "creating",
      cwd: workspace.rootPath,
      workspaceId: workspace.id,
    });
  } catch (error) {
    toast.error(parsePuckError(error).message);
  }
}

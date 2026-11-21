/**
 * Opens a saved profile as the active workspace.
 *
 * 打开保存的连接配置并切换到对应 Workspace。SSH 会同时创建一个 Workspace
 * 终端；SFTP 只打开远程文件工作区，由用户按需创建终端。
 */
import type { ConnectionProfile, Session } from "@/types/connection";
import {
  createWorkspaceTerminal,
  openRemoteWorkspace,
  waitForRemoteWorkspaceReady,
} from "@/lib/workspace-actions";
import { useWorkspaceStore } from "@/stores/workspace-store";

export async function openProfileSession(
  profile: ConnectionProfile,
): Promise<Session | null> {
  if (profile.protocol === "ssh" || profile.protocol === "sftp") {
    openRemoteWorkspace(profile);
    if (profile.protocol === "ssh" && (await waitForRemoteWorkspaceReady())) {
      await createWorkspaceTerminal();
    }
    return null;
  }

  if (profile.protocol === "local") {
    useWorkspaceStore.getState().openLocalWorkspace("~");
    await createWorkspaceTerminal();
    return null;
  }

  return null;
}

/**
 * File explorer bound to the active workspace rather than a terminal cwd.
 *
 * 绑定活动 Workspace 的文件树。现有本地/远程树组件通过稳定的 Workspace 会话
 * 描述复用，目录浏览和终端 cwd 由此解耦。
 */
import { useMemo } from "react";
import { LocalFileExplorerPanel } from "@/components/workspace/local-file-explorer";
import { RemoteFileExplorerPanel } from "@/components/workspace/remote-file-explorer";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Session } from "@/types/connection";

export function WorkspaceExplorer() {
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const remoteStatus = useWorkspaceStore((state) => state.remoteStatus);
  const session = useMemo<Session | null>(() => {
    if (!workspace) return null;
    return {
      id: `workspace:${workspace.id}`,
      kind: "terminal",
      title: workspace.name,
      protocol: workspace.source === "remote" ? "ssh" : "local",
      profileId: workspace.profileId,
      cwd: workspace.rootPath,
      workspaceId: workspace.id,
      status: workspace.source === "remote"
        ? remoteStatus === "connected"
          ? "connected"
          : remoteStatus === "failed" || remoteStatus === "disconnected"
            ? "failed"
            : "creating"
        : "connected",
      createdAt: "",
    };
  }, [remoteStatus, workspace]);

  if (!workspace || !session) return null;
  return workspace.source === "remote" ? (
    <RemoteFileExplorerPanel key={workspace.id} activeSession={session} />
  ) : (
    <LocalFileExplorerPanel key={workspace.id} activeSession={session} />
  );
}

/**
 * Primary workspace sidebar with Explorer, Git and Ports views.
 *
 * 主工作区侧栏：提供 Explorer、Git、Ports 三个同级视图以及工作区切换入口。
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  CableIcon,
  FolderOpenIcon,
  GitBranchIcon,
  ServerIcon,
} from "lucide-react";
import { WorkspaceExplorer } from "@/components/workspace/workspace-explorer";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { GitPanel } from "@/components/workspace/git-panel";
import { PortsPanel } from "@/components/workspace/ports-panel";
import { chooseLocalWorkspace, openRemoteWorkspace } from "@/lib/workspace-actions";
import { useConnectionStore } from "@/stores/connection-store";
import { useWorkspaceStore, type WorkspaceSidebarView } from "@/stores/workspace-store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const views = [
  { id: "explorer", icon: FolderOpenIcon, labelKey: "workspace.explorer" },
  { id: "git", icon: GitBranchIcon, labelKey: "workspace.git" },
  { id: "ports", icon: CableIcon, labelKey: "workspace.ports" },
] as const;

function NoWorkspace() {
  const { t } = useTranslation("common");
  const profiles = useConnectionStore((state) => state.profiles);
  const sshProfiles = profiles.filter((profile) => profile.protocol === "ssh");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{t("workspace.welcomeTitle")}</h2>
        <p className="text-xs leading-5 text-muted-foreground">{t("workspace.welcomeDescription")}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => void chooseLocalWorkspace()}>
        <FolderOpenIcon data-icon="inline-start" />
        {t("workspace.openLocal")}
      </Button>
      {sshProfiles.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="px-1 text-[11px] font-medium text-muted-foreground">{t("workspace.openRemote")}</p>
          {sshProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60"
              onClick={() => openRemoteWorkspace(profile)}
            >
              <ServerIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{profile.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceSidebar() {
  const { t } = useTranslation("common");
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const view = useWorkspaceStore((state) => state.sidebarView);
  const setView = useWorkspaceStore((state) => state.setSidebarView);
  // Port forwarding is SSH-only, so the Ports tab disappears for local
  // workspaces. 端口转发仅限 SSH，本地工作区不显示端口 tab。
  const isRemote = workspace?.source === "remote";

  useEffect(() => {
    if (view === "ports" && !isRemote) {
      setView("explorer");
    }
  }, [isRemote, setView, view]);

  return (
    <aside className="flex h-full min-h-0 flex-col">
      {/* Workspace switching lives here instead of the window header strip. */}
      {/* 工作区切换入口位于侧栏顶部，而不是窗口标题条。 */}
      <div className="flex h-9 shrink-0 items-center border-b border-border/40 px-1.5">
        <WorkspaceSwitcher />
      </div>
      <Tabs
        value={view}
        onValueChange={(value) => setView(value as WorkspaceSidebarView)}
        className="min-h-0 flex-1 gap-0"
      >
        <TabsList className="mx-2 mt-2 w-full shrink-0">
          {views
            .filter((item) => item.id !== "ports" || isRemote)
            .map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                title={t(item.labelKey)}
                className="h-7 gap-1.5 px-1 text-[11px]"
              >
                <item.icon className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{t(item.labelKey)}</span>
              </TabsTrigger>
            ))}
        </TabsList>
        {workspace ? (
          <div className="min-h-0 flex-1">
            {view === "explorer" ? <WorkspaceExplorer /> : null}
            {view === "git" ? <GitPanel workspace={workspace} /> : null}
            {view === "ports" ? <PortsPanel /> : null}
          </div>
        ) : (
          <NoWorkspace />
        )}
      </Tabs>
    </aside>
  );
}

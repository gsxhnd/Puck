/**
 * Workspace picker for local folders, SSH targets and recent workspaces.
 *
 * 工作区切换器：统一提供本地目录、SSH 远端和最近工作区入口。
 */
import { useTranslation } from "react-i18next";
import {
  ChevronDownIcon,
  Clock3Icon,
  FolderOpenIcon,
  FolderIcon,
  ServerIcon,
  Settings2Icon,
} from "lucide-react";
import {
  activateRecentWorkspace,
  chooseLocalWorkspace,
  openRemoteWorkspace,
} from "@/lib/workspace-actions";
import { openConnectionsWindow } from "@/lib/open-connections-window";
import { useConnectionStore } from "@/stores/connection-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WorkspaceSwitcher() {
  const { t } = useTranslation("common");
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const recents = useWorkspaceStore((state) => state.recentWorkspaces);
  const profiles = useConnectionStore((state) => state.profiles);
  const sshProfiles = profiles.filter((profile) => profile.protocol === "ssh");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="min-w-0 max-w-full justify-start px-2">
            {workspace?.source === "remote" ? <ServerIcon /> : <FolderIcon />}
            <span className="truncate font-medium">{workspace?.name ?? "Puck"}</span>
            <ChevronDownIcon className="shrink-0 opacity-60" data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("workspace.open")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void chooseLocalWorkspace()}>
            <FolderOpenIcon />
            {t("workspace.openLocal")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ServerIcon />
              {t("workspace.openRemote")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <DropdownMenuGroup>
                {sshProfiles.map((profile) => (
                  <DropdownMenuItem key={profile.id} onClick={() => openRemoteWorkspace(profile)}>
                    <ServerIcon />
                    <span className="min-w-0 flex-1 truncate">{profile.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{profile.host}</span>
                  </DropdownMenuItem>
                ))}
                {sshProfiles.length === 0 ? (
                  <DropdownMenuItem disabled>{t("workspace.noRemoteProfiles")}</DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => void openConnectionsWindow()}>
            <Settings2Icon />
            {t("workspace.manageConnections")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {recents.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("workspace.recent")}</DropdownMenuLabel>
              {recents.map((recent) => (
                <DropdownMenuItem key={recent.id} onClick={() => activateRecentWorkspace(recent)}>
                  <Clock3Icon />
                  <span className="min-w-0 flex-1 truncate">{recent.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {recent.source === "remote" ? "SSH" : t("protocol.local")}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

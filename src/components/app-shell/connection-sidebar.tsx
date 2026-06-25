import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderOpenIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ServerIcon,
  TerminalIcon,
} from "lucide-react";
import { NewTerminalMenu } from "@/components/terminal/new-terminal-menu";
import { ConnectionDialog } from "@/components/connections/connection-dialog";
import type { ConnectionProfile, ConnectionProtocol } from "@/types/connection";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import { deleteConnectionCredentials } from "@/lib/tauri-ssh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ProtocolFilter = "all" | "local" | "remote" | "file";

const PROTOCOL_BADGE: Record<ConnectionProtocol, string> = {
  local: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  ssh: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  sftp: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  ftp: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ftps: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
};

function matchesFilter(profile: ConnectionProfile, filter: ProtocolFilter) {
  switch (filter) {
    case "local":
      return profile.protocol === "local";
    case "remote":
      return profile.protocol === "ssh";
    case "file":
      return ["sftp", "ftp", "ftps"].includes(profile.protocol);
    default:
      return true;
  }
}

function ConnectionItem({
  profile,
  onEdit,
}: {
  profile: ConnectionProfile;
  onEdit: (profileId: string) => void;
}) {
  const { t } = useTranslation(["connections", "common"]);
  const addSession = useSessionStore((state) => state.addSession);
  const duplicateProfile = useConnectionStore((state) => state.duplicateProfile);
  const removeProfile = useConnectionStore((state) => state.removeProfile);

  const subtitle =
    profile.protocol === "local"
      ? t("common:protocol.local")
      : [profile.username, profile.host].filter(Boolean).join("@");

  const openTerminal = () => {
    addSession({
      kind: "terminal",
      title: profile.name,
      profileId: profile.id,
      protocol: profile.protocol,
      status: profile.protocol === "ssh" ? "creating" : undefined,
    });
  };

  const openFiles = () => {
    addSession({
      kind: "files",
      title: profile.name,
      profileId: profile.id,
      protocol: profile.protocol,
      status:
        profile.protocol === "sftp" || profile.protocol === "ssh"
          ? "creating"
          : undefined,
    });
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={profile.name}
        onClick={() => {
          if (profile.protocol === "local" || profile.protocol === "ssh") {
            openTerminal();
          } else {
            openFiles();
          }
        }}
      >
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold uppercase",
            PROTOCOL_BADGE[profile.protocol],
          )}
        >
          {profile.protocol.slice(0, 3)}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-medium">{profile.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        </div>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction showOnHover aria-label={t("common:actions.edit")}>
              <MoreHorizontalIcon />
            </SidebarMenuAction>
          }
        />
        <DropdownMenuContent side="right" align="start">
          {(profile.protocol === "local" || profile.protocol === "ssh") && (
            <DropdownMenuItem onClick={openTerminal}>
              <TerminalIcon />
              {t("connections:actions.openTerminal")}
            </DropdownMenuItem>
          )}
          {(profile.protocol === "ssh" || profile.protocol === "sftp") && (
            <DropdownMenuItem onClick={openFiles}>
              <FolderOpenIcon />
              {t("connections:actions.openSftp")}
            </DropdownMenuItem>
          )}
          {(profile.protocol === "ftp" || profile.protocol === "ftps") && (
            <DropdownMenuItem onClick={openFiles}>
              <FolderOpenIcon />
              {t("connections:actions.openFiles")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {profile.protocol !== "local" && (
            <DropdownMenuItem onClick={() => onEdit(profile.id)}>
              {t("common:actions.edit")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => duplicateProfile(profile.id)}>
            {t("common:actions.duplicate")}
          </DropdownMenuItem>
          {profile.protocol !== "local" && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deleteConnectionCredentials(profile.id);
                removeProfile(profile.id);
              }}
            >
              {t("common:actions.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

export function ConnectionSidebar() {
  const { t } = useTranslation(["connections", "common"]);
  const profiles = useConnectionStore((state) => state.profiles);
  const openSettings = useSessionStore((state) => state.openSettings);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProtocolFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const openCreateDialog = () => {
    setEditingProfileId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (profileId: string) => {
    setEditingProfileId(profileId);
    setDialogOpen(true);
  };

  const filters = useMemo(
    () =>
      [
        { id: "all" as const, label: t("connections:groups.all") },
        { id: "local" as const, label: t("connections:groups.local") },
        { id: "remote" as const, label: t("connections:groups.remote") },
        { id: "file" as const, label: t("connections:groups.file") },
      ] satisfies Array<{ id: ProtocolFilter; label: string }>,
    [t],
  );

  const filteredProfiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (!matchesFilter(profile, filter)) return false;
      if (!normalized) return true;
      const haystack = [
        profile.name,
        profile.host,
        profile.username,
        profile.protocol,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [profiles, filter, query]);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:hidden">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TerminalIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {t("common:app.name")}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {t("common:app.tagline")}
            </div>
          </div>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("connections:searchPlaceholder")}
          className="h-8 group-data-[collapsible=icon]:hidden"
        />
        <div className="flex flex-wrap gap-1 group-data-[collapsible=icon]:hidden">
          {filters.map((item) => (
            <Button
              key={item.id}
              size="xs"
              variant={filter === item.id ? "secondary" : "ghost"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("connections:title")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <SidebarMenu>
                {filteredProfiles.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                    {query
                      ? t("common:empty.noSearchResults")
                      : t("common:empty.noConnections")}
                  </div>
                ) : (
                  filteredProfiles.map((profile) => (
                    <ConnectionItem
                      key={profile.id}
                      profile={profile}
                      onEdit={openEditDialog}
                    />
                  ))
                )}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        <Button
          className="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
          variant="outline"
          size="sm"
          onClick={openCreateDialog}
        >
          <PlusIcon />
          <span className="group-data-[collapsible=icon]:hidden">
            {t("common:actions.newConnection")}
          </span>
        </Button>
        <NewTerminalMenu className="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0" />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                variant="ghost"
                size="sm"
                onClick={openSettings}
              >
                <ServerIcon />
                <span className="group-data-[collapsible=icon]:hidden">
                  {t("common:actions.settings")}
                </span>
              </Button>
            }
          />
          <TooltipContent side="right">
            {t("common:actions.settings")}
          </TooltipContent>
        </Tooltip>
      </SidebarFooter>
      <ConnectionDialog
        open={dialogOpen}
        profileId={editingProfileId}
        onOpenChange={setDialogOpen}
      />
      <SidebarRail />
    </Sidebar>
  );
}

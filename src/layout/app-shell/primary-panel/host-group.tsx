import { useTranslation } from "react-i18next";
import { useDroppable } from "@dnd-kit/react";
import { ChevronRightIcon } from "lucide-react";
import { GROUP_DROP_PREFIX } from "@/lib/sidebar-groups";
import { type HostDisplayGroup } from "@/lib/hosts-groups";
import type { ConnectionProfile } from "@/types/connection";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { SortableHostItem } from "@/layout/app-shell/primary-panel/host-item";

function EmptyHostGroupDropZone({
  groupId,
  compact = false,
}: {
  groupId: string;
  compact?: boolean;
}) {
  const { t } = useTranslation("connections");
  const { ref, isDropTarget } = useDroppable({
    id: `${GROUP_DROP_PREFIX}${groupId}`,
    data: { type: "group", groupId },
  });

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center rounded-md border border-dashed border-transparent text-[11px] text-muted-foreground/70",
        compact ? "min-h-5" : "min-h-7",
        isDropTarget && "border-primary/40 bg-muted/20 text-muted-foreground",
      )}
    >
      {!compact ? t("sidebarGroups.dropHere") : null}
    </div>
  );
}

export function HostGroup({
  group,
  collapsed,
  onToggle,
  onRename,
  onDelete,
  selectedProfileId,
  profileIndexOffset,
  onDeleteProfile,
  remoteProfiles,
}: {
  group: HostDisplayGroup;
  collapsed: boolean;
  onToggle: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  selectedProfileId: string | null;
  profileIndexOffset: number;
  onDeleteProfile: (profileId: string) => void;
  remoteProfiles: ConnectionProfile[];
}) {
  const { t } = useTranslation("connections");
  const showHeader = group.isCustom || group.name.length > 0;

  const header = (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-7 w-full items-center gap-1 rounded-md px-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronRightIcon
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground/50 transition-transform",
          !collapsed && "rotate-90",
        )}
      />
      <span className={cn("truncate", group.isCustom ? "font-medium" : "font-mono")}>
        {group.name}
      </span>
    </button>
  );

  const content = (
    <div className={cn(showHeader && "space-y-0.5 pl-1")}>
      {group.profiles.length === 0 ? (
        <EmptyHostGroupDropZone groupId={group.id} />
      ) : (
        <>
          {group.profiles.map((profile, index) => (
            <SortableHostItem
              key={profile.id}
              profile={profile}
              index={profileIndexOffset + index}
              selectedProfileId={selectedProfileId}
              onDelete={() => onDeleteProfile(profile.id)}
              remoteProfiles={remoteProfiles}
            />
          ))}
          {group.isCustom ? (
            <EmptyHostGroupDropZone groupId={group.id} compact />
          ) : null}
        </>
      )}
    </div>
  );

  if (!showHeader) {
    return <div className="space-y-0.5">{content}</div>;
  }

  return (
    <div className="space-y-0.5">
      {group.isCustom && (onRename || onDelete) ? (
        <ContextMenu>
          <ContextMenuTrigger render={header} />
          <ContextMenuContent className="w-44">
            {onRename ? (
              <ContextMenuItem onClick={onRename}>
                {t("sidebarGroups.rename")}
              </ContextMenuItem>
            ) : null}
            {onDelete ? (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={onDelete}>
                  {t("sidebarGroups.delete")}
                </ContextMenuItem>
              </>
            ) : null}
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        header
      )}
      {!collapsed ? content : null}
    </div>
  );
}

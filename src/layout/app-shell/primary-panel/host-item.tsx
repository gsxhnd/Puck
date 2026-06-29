import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/react/sortable";
import { PlugIcon } from "lucide-react";
import type { ConnectionProfile } from "@/types/connection";
import { requestOpenConnectionProfile } from "@/lib/connection-bridge";
import { HOST_SORTABLE_GROUP } from "@/lib/hosts-groups";
import { useShellUiStore } from "@/stores/shell-ui-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

function profileSubtitle(profile: ConnectionProfile): string {
  const user = profile.username || "user";
  const host = profile.host || "host";
  const port = profile.port ? `:${profile.port}` : "";
  return `${user}@${host}${port}`;
}

export function SortableHostItem({
  profile,
  index,
  selectedProfileId,
  onDelete,
}: {
  profile: ConnectionProfile;
  index: number;
  selectedProfileId: string | null;
  onDelete: () => void;
}) {
  const { t } = useTranslation(["connections", "common"]);
  const openHostEditor = useShellUiStore((state) => state.openHostEditor);
  const { ref, isDragging, isDropTarget } = useSortable({
    id: profile.id,
    index,
    group: HOST_SORTABLE_GROUP,
    transition: { idle: true },
  });

  const isSelected = profile.id === selectedProfileId;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={ref}
            role="button"
            tabIndex={0}
            onClick={() => openHostEditor(profile.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openHostEditor(profile.id);
              }
            }}
            className={cn(
              "flex w-full cursor-grab flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors active:cursor-grabbing",
              isSelected
                ? "bg-foreground/12 text-foreground dark:bg-foreground/22"
                : "hover:bg-muted/50",
              isDragging && "opacity-50",
              isDropTarget && "bg-foreground/10 dark:bg-foreground/18",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "shrink-0 rounded px-1 py-0.5 font-mono text-[10px] uppercase",
                  "bg-muted text-muted-foreground",
                )}
              >
                {t(`common:protocol.${profile.protocol}`)}
              </span>
              <span className="min-w-0 truncate text-sm font-medium">
                {profile.name}
              </span>
            </div>
            <span className="truncate pl-0.5 text-xs text-muted-foreground">
              {profileSubtitle(profile)}
            </span>
          </div>
        }
      />
      <ContextMenuContent className="w-44">
        <ContextMenuItem
          onClick={() => void requestOpenConnectionProfile(profile.id)}
        >
          <PlugIcon />
          {t("connections:manager.connect")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          {t("common:actions.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

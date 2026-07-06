import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ServerIcon, TerminalSquareIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function PrimaryPanelTabsList({ iconOnly = false }: { iconOnly?: boolean }) {
  const { t } = useTranslation("connections");

  const items = useMemo(
    () =>
      [
        {
          id: "sessions" as const,
          icon: TerminalSquareIcon,
          label: t("primaryPanel.tabs.sessions"),
        },
        {
          id: "hosts" as const,
          icon: ServerIcon,
          label: t("primaryPanel.tabs.hosts"),
        },
      ] as const,
    [t],
  );

  return (
    <TabsList
      className={cn(
        "h-7 min-w-0 gap-0.5 bg-transparent p-0",
        iconOnly && "gap-0",
      )}
    >
      {items.map((item) => {
        const trigger = (
          <TabsTrigger
            key={item.id}
            value={item.id}
            aria-label={item.label}
            className={cn(
              "h-7 max-w-full flex-none gap-1 px-2 py-0 text-[10px] font-medium tracking-wide data-active:bg-muted",
              iconOnly && "size-7 justify-center px-0",
            )}
          >
            <item.icon className="size-3.5 shrink-0" />
            {iconOnly ? null : (
              <span className="truncate">{item.label}</span>
            )}
          </TabsTrigger>
        );

        if (!iconOnly) {
          return trigger;
        }

        return (
          <Tooltip key={item.id}>
            <TooltipTrigger render={trigger} />
            <TooltipContent side="bottom">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </TabsList>
  );
}

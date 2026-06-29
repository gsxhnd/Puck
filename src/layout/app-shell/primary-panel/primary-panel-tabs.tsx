import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ServerIcon, TerminalSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PrimaryPanelTab } from "@/types/shell-ui";

const tabTransition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const;

export function PrimaryPanelTabs({
  tab,
  onTabChange,
}: {
  tab: PrimaryPanelTab;
  onTabChange: (tab: PrimaryPanelTab) => void;
}) {
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
    <LayoutGroup id="primary-panel-tabs">
      <div className="flex items-center gap-0.5">
        {items.map((item) => {
          const isSelected = tab === item.id;
          const tabButton = (
            <motion.div layout transition={tabTransition}>
              <Button
                variant="ghost"
                size={isSelected ? "xs" : "icon-xs"}
                aria-label={item.label}
                aria-pressed={isSelected}
                className={cn(
                  "overflow-hidden",
                  isSelected
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}
                onClick={() => onTabChange(item.id)}
              >
                <item.icon />
                <AnimatePresence initial={false} mode="popLayout">
                  {isSelected ? (
                    <motion.span
                      key={`${item.id}-label`}
                      layout
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={tabTransition}
                      className="overflow-hidden text-[10px] font-medium tracking-wide whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </Button>
            </motion.div>
          );

          if (isSelected) {
            return <div key={item.id}>{tabButton}</div>;
          }

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger render={tabButton} />
              <TooltipContent side="bottom">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

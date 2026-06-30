import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ServerIcon, TerminalSquareIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PrimaryPanelTabsList() {
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
    <TabsList className="h-7 gap-0.5 bg-transparent p-0">
      {items.map((item) => (
        <TabsTrigger
          key={item.id}
          value={item.id}
          className="h-7 flex-none gap-1 px-2 py-0 text-[10px] font-medium tracking-wide data-active:bg-muted"
        >
          <item.icon className="size-3.5" />
          <span>{item.label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

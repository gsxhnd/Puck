import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "lucide-react";
import {
  DEFAULT_SESSION_PRIVILEGES,
  type SessionPrivilegeKey,
} from "@/types/session-privileges";
import { useSessionPrivilegesStore } from "@/stores/session-privileges-store";
import { cn } from "@/lib/utils";

type PrivilegeSection = {
  titleKey: string;
  items: Array<{ key: SessionPrivilegeKey; labelKey: string }>;
};

const PRIVILEGE_SECTIONS: PrivilegeSection[] = [
  {
    titleKey: "titleMenu.privileges.sections.sound",
    items: [
      { key: "soundMute", labelKey: "titleMenu.privileges.soundMute" },
      {
        key: "beepOnErrorExit",
        labelKey: "titleMenu.privileges.beepOnErrorExit",
      },
      {
        key: "allowTerminalBell",
        labelKey: "titleMenu.privileges.allowTerminalBell",
      },
    ],
  },
  {
    titleKey: "titleMenu.privileges.sections.notification",
    items: [
      {
        key: "notificationMute",
        labelKey: "titleMenu.privileges.notificationMute",
      },
      {
        key: "notifyOnCommandFinish",
        labelKey: "titleMenu.privileges.notifyOnCommandFinish",
      },
      {
        key: "notifyOnErrorExit",
        labelKey: "titleMenu.privileges.notifyOnErrorExit",
      },
      {
        key: "notifyOnWatchFinish",
        labelKey: "titleMenu.privileges.notifyOnWatchFinish",
      },
      {
        key: "allowAppNotifications",
        labelKey: "titleMenu.privileges.allowAppNotifications",
      },
    ],
  },
  {
    titleKey: "titleMenu.privileges.sections.tabBadge",
    items: [
      {
        key: "tabBadgeWhenCommandFinishes",
        labelKey: "titleMenu.privileges.tabBadgeWhenCommandFinishes",
      },
      {
        key: "tabBadgeWhenCommandFails",
        labelKey: "titleMenu.privileges.tabBadgeWhenCommandFails",
      },
    ],
  },
  {
    titleKey: "titleMenu.privileges.sections.caffeinate",
    items: [
      {
        key: "keepAwakeWhenTaskRunning",
        labelKey: "titleMenu.privileges.keepAwakeWhenTaskRunning",
      },
    ],
  },
  {
    titleKey: "titleMenu.privileges.sections.mouse",
    items: [
      {
        key: "allowMouseCapture",
        labelKey: "titleMenu.privileges.allowMouseCapture",
      },
    ],
  },
];

function PrivilegeToggleItem({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-foreground/90 hover:bg-muted/70"
      onClick={onToggle}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {checked ? <CheckIcon className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

export function TerminalPrivilegesSubmenu({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation("terminal");
  const stored = useSessionPrivilegesStore(
    (state) => state.bySessionId[sessionId],
  );
  const privileges = useMemo(
    () => ({ ...DEFAULT_SESSION_PRIVILEGES, ...stored }),
    [stored],
  );
  const togglePrivilege = useSessionPrivilegesStore(
    (state) => state.togglePrivilege,
  );

  return (
    <div className="max-h-[min(70vh,28rem)] overflow-y-auto py-1">
      {PRIVILEGE_SECTIONS.map((section, sectionIndex) => (
        <div
          key={section.titleKey}
          className={cn(sectionIndex > 0 && "mt-1 border-t border-border/60 pt-1")}
        >
          <p className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {t(section.titleKey)}
          </p>
          {section.items.map((item) => (
            <PrivilegeToggleItem
              key={item.key}
              label={t(item.labelKey)}
              checked={privileges[item.key]}
              onToggle={() => togglePrivilege(sessionId, item.key)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

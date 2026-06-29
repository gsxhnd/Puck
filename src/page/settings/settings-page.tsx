import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_ICONS,
  type SettingsSection,
} from "@/page/settings/settings-constants";
import { SettingsSelect } from "@/page/settings/settings-primitives";
import { GeneralSettingsSection } from "@/page/settings/sections/general-section";
import { AppearanceSettingsSection } from "@/page/settings/sections/appearance-section";
import { TerminalSettingsSection } from "@/page/settings/sections/terminal-section";
import { ConnectionsSettingsSection } from "@/page/settings/sections/connections-section";
import { KeyboardSettingsSection } from "@/page/settings/sections/keyboard-section";
import { AboutSettingsSection } from "@/page/settings/sections/about-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Settings window page with sidebar navigation and section panels.
 *
 * 设置窗口主页面：左侧（桌面端）为区段导航，右侧为对应设置面板；移动端
 * 以顶部下拉选择区段。各具体设置内容已拆分到 `sections/` 子目录，本文件
 * 只负责导航状态与布局编排。
 */
export function SettingsPage() {
  const { t } = useTranslation("settings");
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("general");

  const sectionLabels = Object.fromEntries(
    SETTINGS_SECTIONS.map((section) => [section, t(`settings:sections.${section}`)]),
  ) as Record<SettingsSection, string>;

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-52 shrink-0 border-r bg-muted/20 p-3 md:block">
        <div className="px-2 py-1 text-sm font-semibold">
          {t("settings:title")}
        </div>
        <nav className="mt-2 space-y-1">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = SETTINGS_SECTION_ICONS[section];
            const isActive = activeSection === section;
            return (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-foreground" : "opacity-70",
                  )}
                />
                <span className="min-w-0 truncate">{sectionLabels[section]}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          <div className="md:hidden">
            <SettingsSelect
              value={activeSection}
              options={[...SETTINGS_SECTIONS]}
              labels={sectionLabels}
              onChange={setActiveSection}
              className="w-full"
            />
          </div>

          {activeSection === "general" ? <GeneralSettingsSection /> : null}
          {activeSection === "appearance" ? <AppearanceSettingsSection /> : null}
          {activeSection === "terminal" ? <TerminalSettingsSection /> : null}
          {activeSection === "connections" ? (
            <ConnectionsSettingsSection />
          ) : null}
          {activeSection === "keyboard" ? <KeyboardSettingsSection /> : null}
          {activeSection === "about" ? <AboutSettingsSection /> : null}
        </div>
      </ScrollArea>
    </div>
  );
}

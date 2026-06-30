import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_ICONS,
  type SettingsSection,
} from "@/page/settings/settings-constants";
import { SettingsCombobox } from "@/page/settings/settings-primitives";
import { SETTINGS_SECTION_VIEWS } from "@/page/settings/settings-section-views";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const ActiveSection = SETTINGS_SECTION_VIEWS[activeSection];

  return (
    <Tabs
      value={activeSection}
      onValueChange={(value) => setActiveSection(value as SettingsSection)}
      orientation="vertical"
      className="h-full min-h-0"
    >
      <aside className="hidden w-52 shrink-0 flex-col border-r bg-muted/20 p-3 md:flex">
        <div className="px-2 py-1 text-sm font-semibold">
          {t("settings:title")}
        </div>
        <TabsList
          variant="line"
          className="mt-2 h-fit w-full flex-col items-stretch bg-transparent p-0"
        >
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = SETTINGS_SECTION_ICONS[section];
            return (
              <TabsTrigger
                key={section}
                value={section}
                className="w-full justify-start gap-2 px-2 py-1.5"
              >
                <Icon data-icon="inline-start" />
                <span className="min-w-0 truncate">{sectionLabels[section]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </aside>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          <div className="md:hidden">
            <SettingsCombobox
              value={activeSection}
              options={[...SETTINGS_SECTIONS]}
              labels={sectionLabels}
              onChange={setActiveSection}
              className="w-full"
              placeholder={t("settings:combobox.selectSection")}
            />
          </div>

          <ActiveSection key={activeSection} />
        </div>
      </ScrollArea>
    </Tabs>
  );
}

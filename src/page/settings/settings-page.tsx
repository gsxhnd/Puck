import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useAppVersion } from "@/lib/use-app-version";
import { COLOR_THEME_IDS } from "@/lib/color-themes";
import type { ColorThemeId } from "@/lib/color-themes";
import { formatShortcut } from "@/lib/format-shortcut";
import { openConnectionsWindow } from "@/lib/open-connections-window";
import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  type AppLanguage,
  type ThemeMode,
} from "@/types/settings";
import type { SessionPrivilegeKey } from "@/types/session-privileges";
import { SettingsCredentials } from "@/page/settings/settings-credentials";
import { SettingsKnownHosts } from "@/page/settings/settings-known-hosts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type SettingsSection =
  | "general"
  | "appearance"
  | "terminal"
  | "connections"
  | "keyboard"
  | "about";

const SECTIONS: SettingsSection[] = [
  "general",
  "appearance",
  "terminal",
  "connections",
  "keyboard",
  "about",
];

const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];
const LANGUAGES: AppLanguage[] = ["zh-CN", "en-US"];

const DEFAULT_PRIVILEGE_ITEMS: Array<{
  key: SessionPrivilegeKey;
  labelKey: string;
  descriptionKey?: string;
}> = [
  {
    key: "allowTerminalBell",
    labelKey: "settings:terminal.privileges.allowTerminalBell",
  },
  {
    key: "notifyOnErrorExit",
    labelKey: "settings:terminal.privileges.notifyOnErrorExit",
  },
  {
    key: "notifyOnCommandFinish",
    labelKey: "settings:terminal.privileges.notifyOnCommandFinish",
  },
  {
    key: "tabBadgeWhenCommandFinishes",
    labelKey: "settings:terminal.privileges.tabBadgeWhenCommandFinishes",
  },
  {
    key: "keepAwakeWhenTaskRunning",
    labelKey: "settings:terminal.privileges.keepAwakeWhenTaskRunning",
  },
];

const KEYBOARD_SHORTCUTS: Array<{ labelKey: string; shortcut: string }> = [
  { labelKey: "settings:keyboard.newTerminal", shortcut: "⌘T" },
  { labelKey: "settings:keyboard.closeTab", shortcut: "⌘W" },
  { labelKey: "settings:keyboard.commandPalette", shortcut: "⌘K" },
  { labelKey: "settings:keyboard.openSettings", shortcut: "⌘," },
  { labelKey: "settings:keyboard.togglePrimaryPanel", shortcut: "⇧⌘L" },
  { labelKey: "settings:keyboard.toggleSecondPanel", shortcut: "⇧⌘R" },
  { labelKey: "settings:keyboard.search", shortcut: "⌘F" },
  { labelKey: "settings:keyboard.searchAllTabs", shortcut: "⇧⌘F" },
  { labelKey: "settings:keyboard.jumpToOutline", shortcut: "⌘J" },
  { labelKey: "settings:keyboard.splitRight", shortcut: "⌘D" },
  { labelKey: "settings:keyboard.splitLeft", shortcut: "⌥⌘D" },
  { labelKey: "settings:keyboard.splitDown", shortcut: "⇧⌘D" },
  { labelKey: "settings:keyboard.splitUp", shortcut: "⌥⇧⌘D" },
];

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">{title}</div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsSelect<T extends string>({
  value,
  options,
  labels,
  onChange,
  className,
}: {
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  className?: string;
}) {
  const items = Object.fromEntries(
    options.map((option) => [option, labels[option]]),
  ) as Record<T, string>;

  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        if (next !== null) {
          onChange(next as T);
        }
      }}
    >
      <SelectTrigger size="sm" className={cn("w-48", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SettingsPage() {
  const { t } = useTranslation(["settings", "common"]);
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("general");
  const appVersion = useAppVersion();

  const language = useAppSettingsStore((state) => state.language);
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const fontFamily = useAppSettingsStore((state) => state.fontFamily);
  const fontSize = useAppSettingsStore((state) => state.fontSize);
  const cursorBlink = useAppSettingsStore((state) => state.cursorBlink);
  const scrollback = useAppSettingsStore((state) => state.scrollback);
  const copyOnSelect = useAppSettingsStore((state) => state.copyOnSelect);
  const openLocalOnStart = useAppSettingsStore(
    (state) => state.openLocalTerminalOnStart,
  );
  const primaryPanelOpen = useAppSettingsStore((state) => state.primaryPanelOpen);
  const secondPanelOpen = useAppSettingsStore((state) => state.secondPanelOpen);
  const defaultPrivileges = useAppSettingsStore(
    (state) => state.defaultSessionPrivileges,
  );

  const setLanguage = useAppSettingsStore((state) => state.setLanguage);
  const setColorTheme = useAppSettingsStore((state) => state.setColorTheme);
  const setThemeMode = useAppSettingsStore((state) => state.setThemeMode);
  const setFontFamily = useAppSettingsStore((state) => state.setFontFamily);
  const setFontSize = useAppSettingsStore((state) => state.setFontSize);
  const setCursorBlink = useAppSettingsStore((state) => state.setCursorBlink);
  const setScrollback = useAppSettingsStore((state) => state.setScrollback);
  const setCopyOnSelect = useAppSettingsStore((state) => state.setCopyOnSelect);
  const setOpenLocalOnStart = useAppSettingsStore(
    (state) => state.setOpenLocalTerminalOnStart,
  );
  const setPrimaryPanelOpen = useAppSettingsStore(
    (state) => state.setPrimaryPanelOpen,
  );
  const setSecondPanelOpen = useAppSettingsStore(
    (state) => state.setSecondPanelOpen,
  );
  const setDefaultPrivilege = useAppSettingsStore(
    (state) => state.setDefaultPrivilege,
  );
  const resetSettings = useAppSettingsStore((state) => state.reset);

  const languageLabels = Object.fromEntries(
    LANGUAGES.map((lng) => [lng, lng === "zh-CN" ? "中文" : "English"]),
  ) as Record<AppLanguage, string>;

  const themeModeLabels = Object.fromEntries(
    THEME_MODES.map((item) => [item, t(`common:theme.${item}`)]),
  ) as Record<ThemeMode, string>;

  const colorThemeLabels = Object.fromEntries(
    COLOR_THEME_IDS.map((item) => [item, t(`settings:colorThemes.${item}`)]),
  ) as Record<ColorThemeId, string>;

  const sectionLabels = Object.fromEntries(
    SECTIONS.map((section) => [section, t(`settings:sections.${section}`)]),
  ) as Record<SettingsSection, string>;

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-52 shrink-0 border-r bg-muted/20 p-3 md:block">
        <div className="px-2 py-1 text-sm font-semibold">
          {t("settings:title")}
        </div>
        <nav className="mt-2 space-y-1">
          {SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={cn(
                "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                activeSection === section
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {sectionLabels[section]}
            </button>
          ))}
        </nav>
      </aside>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          <div className="md:hidden">
            <SettingsSelect
              value={activeSection}
              options={[...SECTIONS]}
              labels={sectionLabels}
              onChange={setActiveSection}
              className="w-full"
            />
          </div>

          {activeSection === "general" ? (
            <section>
              <h2 className="text-base font-semibold">
                {t("settings:sections.general")}
              </h2>
              <div className="mt-2 divide-y rounded-xl border bg-card px-4">
                <SettingsRow
                  title={t("settings:general.language")}
                  description={t("settings:general.languageDescription")}
                >
                  <SettingsSelect
                    value={language}
                    options={LANGUAGES}
                    labels={languageLabels}
                    onChange={setLanguage}
                  />
                </SettingsRow>
                <SettingsRow
                  title={t("settings:general.openLocalOnStart")}
                  description={t("settings:general.openLocalOnStartDescription")}
                >
                  <Switch
                    checked={openLocalOnStart}
                    onCheckedChange={setOpenLocalOnStart}
                  />
                </SettingsRow>
                <SettingsRow
                  title={t("settings:general.showPrimaryPanel")}
                  description={t("settings:general.showPrimaryPanelDescription")}
                >
                  <Switch
                    checked={primaryPanelOpen}
                    onCheckedChange={setPrimaryPanelOpen}
                  />
                </SettingsRow>
                <SettingsRow
                  title={t("settings:general.showSecondPanel")}
                  description={t("settings:general.showSecondPanelDescription")}
                >
                  <Switch
                    checked={secondPanelOpen}
                    onCheckedChange={setSecondPanelOpen}
                  />
                </SettingsRow>
                <SettingsRow
                  title={t("settings:general.resetSettings")}
                  description={t("settings:general.resetSettingsDescription")}
                >
                  <Button variant="outline" size="sm" onClick={resetSettings}>
                    {t("settings:general.resetSettingsAction")}
                  </Button>
                </SettingsRow>
              </div>
            </section>
          ) : null}

          {activeSection === "appearance" ? (
            <section>
              <h2 className="text-base font-semibold">
                {t("settings:sections.appearance")}
              </h2>
              <div className="mt-2 divide-y rounded-xl border bg-card px-4">
                <SettingsRow
                  title={t("settings:appearance.colorTheme")}
                  description={t("settings:appearance.colorThemeDescription")}
                >
                  <SettingsSelect
                    value={colorTheme}
                    options={[...COLOR_THEME_IDS]}
                    labels={colorThemeLabels}
                    onChange={setColorTheme}
                    className="w-56"
                  />
                </SettingsRow>
                <SettingsRow
                  title={t("settings:appearance.themeMode")}
                  description={t("settings:appearance.themeModeDescription")}
                >
                  <SettingsSelect
                    value={themeMode}
                    options={THEME_MODES}
                    labels={themeModeLabels}
                    onChange={setThemeMode}
                  />
                </SettingsRow>
                <SettingsRow title={t("settings:appearance.fontFamily")}>
                  <Input
                    value={fontFamily}
                    onChange={(event) => setFontFamily(event.target.value)}
                    placeholder={DEFAULT_TERMINAL_FONT_FAMILY}
                    className="w-56 font-mono text-xs"
                  />
                </SettingsRow>
                <SettingsRow title={t("settings:appearance.fontSize")}>
                  <Input
                    type="number"
                    min={10}
                    max={24}
                    value={fontSize}
                    onChange={(event) =>
                      setFontSize(Number(event.target.value) || 14)
                    }
                    className="w-20"
                  />
                </SettingsRow>
              </div>
            </section>
          ) : null}

          {activeSection === "terminal" ? (
            <section className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">
                  {t("settings:sections.terminal")}
                </h2>
                <div className="mt-2 divide-y rounded-xl border bg-card px-4">
                  <SettingsRow
                    title={t("settings:terminal.cursorBlink")}
                    description={t("settings:terminal.cursorBlinkDescription")}
                  >
                    <Switch
                      checked={cursorBlink}
                      onCheckedChange={setCursorBlink}
                    />
                  </SettingsRow>
                  <SettingsRow
                    title={t("settings:terminal.copyOnSelect")}
                    description={t("settings:terminal.copyOnSelectDescription")}
                  >
                    <Switch
                      checked={copyOnSelect}
                      onCheckedChange={setCopyOnSelect}
                    />
                  </SettingsRow>
                  <SettingsRow
                    title={t("settings:terminal.scrollback")}
                    description={t("settings:terminal.scrollbackDescription")}
                  >
                    <Input
                      type="number"
                      min={1000}
                      max={50000}
                      step={1000}
                      value={scrollback}
                      onChange={(event) =>
                        setScrollback(Number(event.target.value) || 5000)
                      }
                      className="w-28"
                    />
                  </SettingsRow>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">
                  {t("settings:terminal.defaultPrivileges")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("settings:terminal.defaultPrivilegesDescription")}
                </p>
                <div className="mt-2 divide-y rounded-xl border bg-card px-4">
                  {DEFAULT_PRIVILEGE_ITEMS.map((item) => (
                    <SettingsRow key={item.key} title={t(item.labelKey)}>
                      <Switch
                        checked={defaultPrivileges[item.key]}
                        onCheckedChange={(value) =>
                          setDefaultPrivilege(item.key, value)
                        }
                      />
                    </SettingsRow>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "connections" ? (
            <section className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">
                  {t("settings:connections.credentials")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("settings:connections.credentialsDescription")}
                </p>
                <div className="mt-2 rounded-xl border bg-card px-4">
                  <SettingsCredentials />
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold">
                  {t("settings:connections.hostKeys")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("settings:connections.hostKeysDescription")}
                </p>
                <div className="mt-2 rounded-xl border bg-card px-4">
                  <SettingsKnownHosts />
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "keyboard" ? (
            <section>
              <h2 className="text-base font-semibold">
                {t("settings:sections.keyboard")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("settings:keyboard.description")}
              </p>
              <div className="mt-3 overflow-hidden rounded-xl border bg-card">
                {KEYBOARD_SHORTCUTS.map((item, index) => (
                  <div key={item.labelKey}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span>{t(item.labelKey)}</span>
                      <Kbd>{formatShortcut(item.shortcut)}</Kbd>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection === "about" ? (
            <section>
              <h2 className="text-base font-semibold">
                {t("settings:sections.about")}
              </h2>
              <div className="mt-2 space-y-4 rounded-xl border bg-card px-4 py-4 text-sm text-muted-foreground">
                <div>
                  <div className="font-medium text-foreground">
                    {t("common:app.name")}
                  </div>
                  <p className="mt-1">{t("settings:about.description")}</p>
                  <p className="mt-3">
                    {t("settings:about.version")}: {appVersion}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openConnectionsWindow()}
                >
                  {t("settings:about.manageConnections")}
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

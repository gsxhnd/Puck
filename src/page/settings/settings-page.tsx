import { useTranslation } from "react-i18next";
import packageJson from "../../../package.json";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { COLOR_THEME_IDS } from "@/lib/color-themes";
import type { ColorThemeId } from "@/lib/color-themes";
import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  type AppLanguage,
  type ThemeMode,
} from "@/types/settings";
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

type SettingsSection = "general" | "appearance" | "connections" | "keyboard" | "about";

const SECTIONS: SettingsSection[] = [
  "general",
  "appearance",
  "connections",
  "keyboard",
  "about",
];

const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

const LANGUAGES: AppLanguage[] = ["zh-CN", "en-US"];

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
  const language = useAppSettingsStore((state) => state.language);
  const colorTheme = useAppSettingsStore((state) => state.colorTheme);
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const fontFamily = useAppSettingsStore((state) => state.fontFamily);
  const fontSize = useAppSettingsStore((state) => state.fontSize);
  const openLocalOnStart = useAppSettingsStore(
    (state) => state.openLocalTerminalOnStart,
  );
  const setLanguage = useAppSettingsStore((state) => state.setLanguage);
  const setColorTheme = useAppSettingsStore((state) => state.setColorTheme);
  const setThemeMode = useAppSettingsStore((state) => state.setThemeMode);
  const setFontFamily = useAppSettingsStore((state) => state.setFontFamily);
  const setFontSize = useAppSettingsStore((state) => state.setFontSize);
  const setOpenLocalOnStart = useAppSettingsStore(
    (state) => state.setOpenLocalTerminalOnStart,
  );

  const languageLabels = Object.fromEntries(
    LANGUAGES.map((lng) => [
      lng,
      lng === "zh-CN" ? "中文" : "English",
    ]),
  ) as Record<AppLanguage, string>;

  const themeModeLabels = Object.fromEntries(
    THEME_MODES.map((item) => [item, t(`common:theme.${item}`)]),
  ) as Record<ThemeMode, string>;

  const colorThemeLabels = Object.fromEntries(
    COLOR_THEME_IDS.map((item) => [
      item,
      t(`settings:colorThemes.${item}`),
    ]),
  ) as Record<ColorThemeId, string>;

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-52 shrink-0 border-r bg-muted/20 p-3 md:block">
        <div className="px-2 py-1 text-sm font-semibold">{t("settings:title")}</div>
        <nav className="mt-2 space-y-1">
          {SECTIONS.map((section) => (
            <a
              key={section}
              href={`#settings-${section}`}
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t(`settings:sections.${section}`)}
            </a>
          ))}
        </nav>
      </aside>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-8 p-6">
          <section id="settings-general">
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
            </div>
          </section>

          <section id="settings-appearance">
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
              <SettingsRow
                title={t("settings:appearance.fontFamily")}
              >
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

          <section id="settings-connections">
            <h2 className="text-base font-semibold">
              {t("settings:sections.connections")}
            </h2>
            <div className="mt-2 divide-y rounded-xl border bg-card px-4">
              <SettingsRow
                title={t("settings:connections.credentials")}
                description={t("settings:connections.credentialsDescription")}
              >
                <Button variant="outline" size="sm" disabled>
                  {t("common:actions.edit")}
                </Button>
              </SettingsRow>
              <SettingsRow
                title={t("settings:connections.hostKeys")}
                description={t("settings:connections.hostKeysDescription")}
              >
                <Button variant="outline" size="sm" disabled>
                  {t("common:actions.open")}
                </Button>
              </SettingsRow>
            </div>
          </section>

          <section id="settings-keyboard">
            <h2 className="text-base font-semibold">
              {t("settings:sections.keyboard")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings:keyboard.description")}
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border bg-card">
              {[
                ["settings:keyboard.newTerminal", "⌘T"],
                ["settings:keyboard.closeTab", "⌘W"],
                ["settings:keyboard.commandPalette", "⌘K"],
                ["settings:keyboard.openSettings", "⌘,"],
                ["settings:keyboard.search", "⌘F"],
              ].map(([labelKey, shortcut], index) => (
                <div key={labelKey}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{t(labelKey)}</span>
                    <Kbd>{shortcut}</Kbd>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="settings-about">
            <h2 className="text-base font-semibold">
              {t("settings:sections.about")}
            </h2>
            <div
              className={cn(
                "mt-2 rounded-xl border bg-card px-4 py-4 text-sm text-muted-foreground",
              )}
            >
              <div className="font-medium text-foreground">
                {t("common:app.name")}
              </div>
              <p className="mt-1">{t("settings:about.description")}</p>
              <p className="mt-3">
                {t("settings:about.version")}: {packageJson.version}
              </p>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

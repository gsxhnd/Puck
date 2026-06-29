import { useTranslation } from "react-i18next";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { DEFAULT_PRIVILEGE_ITEMS } from "@/page/settings/settings-constants";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsRow } from "@/page/settings/settings-primitives";

/**
 * Terminal behavior settings and default session privileges.
 *
 * 「终端」设置区段：光标闪烁、选中即复制、回滚行数等终端行为，以及新建
 * 会话时默认启用的权限开关（通知、响铃、保持唤醒等）。
 */
export function TerminalSettingsSection() {
  const { t } = useTranslation("settings");
  const cursorBlink = useAppSettingsStore((state) => state.cursorBlink);
  const scrollback = useAppSettingsStore((state) => state.scrollback);
  const copyOnSelect = useAppSettingsStore((state) => state.copyOnSelect);
  const defaultPrivileges = useAppSettingsStore(
    (state) => state.defaultSessionPrivileges,
  );
  const setCursorBlink = useAppSettingsStore((state) => state.setCursorBlink);
  const setScrollback = useAppSettingsStore((state) => state.setScrollback);
  const setCopyOnSelect = useAppSettingsStore((state) => state.setCopyOnSelect);
  const setDefaultPrivilege = useAppSettingsStore(
    (state) => state.setDefaultPrivilege,
  );

  return (
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
  );
}

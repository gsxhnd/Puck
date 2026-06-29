import { useTranslation } from "react-i18next";
import { formatShortcut } from "@/lib/format-shortcut";
import { KEYBOARD_SHORTCUTS } from "@/page/settings/settings-constants";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

/**
 * Read-only reference of global keyboard shortcuts.
 *
 * 「快捷键」设置区段：以只读列表展示应用内全局快捷键，供用户查阅。
 */
export function KeyboardSettingsSection() {
  const { t } = useTranslation("settings");

  return (
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
  );
}

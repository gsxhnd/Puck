import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@/lib/platform";
import { cn } from "@/lib/utils";

type MacTrafficLightsProps = {
  className?: string;
};

export function MacTrafficLights({ className }: MacTrafficLightsProps) {
  const { t } = useTranslation("common");

  const minimize = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  }, []);

  const toggleMaximize = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  }, []);

  const close = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  }, []);

  return (
    <div className={cn("mac-traffic-lights", className)}>
      <button
        type="button"
        className="mac-traffic-light mac-traffic-light-close"
        aria-label={t("window.close")}
        onClick={() => void close()}
      />
      <button
        type="button"
        className="mac-traffic-light mac-traffic-light-minimize"
        aria-label={t("window.minimize")}
        onClick={() => void minimize()}
      />
      <button
        type="button"
        className="mac-traffic-light mac-traffic-light-maximize"
        aria-label={t("window.maximize")}
        onClick={() => void toggleMaximize()}
      />
    </div>
  );
}

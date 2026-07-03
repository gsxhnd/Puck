import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@/lib/platform";
import { cn } from "@/lib/utils";

type WindowControlsProps = {
  className?: string;
};

function WinMinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="1" y="4.5" width="8" height="1" fill="currentColor" />
    </svg>
  );
}

function WinMaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function WinRestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect
        x="3"
        y="1"
        width="6"
        height="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect
        x="1"
        y="3"
        width="6"
        height="6"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function WinCloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M2.2 2.2 7.8 7.8M7.8 2.2 2.2 7.8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WindowControls({ className }: WindowControlsProps) {
  const { t } = useTranslation("common");
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      setIsMaximized(await appWindow.isMaximized());
      const dispose = await appWindow.onResized(async () => {
        setIsMaximized(await appWindow.isMaximized());
      });
      if (disposed) {
        dispose();
        return;
      }
      unlisten = dispose;
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

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
    <div className={cn("win-window-controls", className)}>
      <button
        type="button"
        className="win-window-control"
        aria-label={t("window.minimize")}
        onClick={() => void minimize()}
      >
        <WinMinimizeIcon />
      </button>
      <button
        type="button"
        className="win-window-control"
        aria-label={isMaximized ? t("window.restore") : t("window.maximize")}
        onClick={() => void toggleMaximize()}
      >
        {isMaximized ? <WinRestoreIcon /> : <WinMaximizeIcon />}
      </button>
      <button
        type="button"
        className="win-window-control win-window-control-close"
        aria-label={t("window.close")}
        onClick={() => void close()}
      >
        <WinCloseIcon />
      </button>
    </div>
  );
}

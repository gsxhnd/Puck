import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { onSessionStatus } from "@/lib/tauri-ssh";
import { notifySessionFailure } from "@/lib/session-notifications";
import { formatSidebarLabel } from "@/lib/session-display";
import { useSessionStore } from "@/stores/session-store";
import { getAppWindowMode } from "@/lib/app-window";

/** Shows toast or system notifications when a session connection fails. */
export function SessionStatusListener() {
  const { t } = useTranslation(["terminal", "errors"]);

  useEffect(() => {
    if (getAppWindowMode() !== "main") return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      unlisten = await onSessionStatus((event) => {
        if (disposed || event.status !== "failed") return;

        const session = useSessionStore
          .getState()
          .sessions.find((item) => item.id === event.sessionId);
        if (!session) return;

        const label = formatSidebarLabel(session);
        const message =
          event.message ??
          (event.errorCode
            ? t(`errors:${event.errorCode}`, {
                defaultValue: event.errorCode,
              })
            : t("terminal:status.failed"));

        void notifySessionFailure(
          t("terminal:notifications.connectionFailed", { session: label }),
          message,
        );
      });
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [t]);

  return null;
}

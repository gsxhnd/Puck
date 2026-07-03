import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { subscribeSessionStatus } from "@/lib/tauri-ssh";
import { notifySessionFailure } from "@/lib/session-notifications";
import { formatSidebarLabel } from "@/lib/session-display";
import { useSessionStore } from "@/stores/session-store";
import { getAppWindowMode } from "@/lib/app-window";

/** Shows toast or system notifications when a session connection fails. */
export function SessionStatusListener() {
  const { t } = useTranslation(["terminal", "errors"]);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (getAppWindowMode() !== "main") return;

    return subscribeSessionStatus((event) => {
      if (event.status !== "failed") return;

      const session = useSessionStore
        .getState()
        .sessions.find((item) => item.id === event.sessionId);
      if (!session) return;

      const label = formatSidebarLabel(session);
      const message =
        event.message ??
        (event.errorCode
          ? tRef.current(`errors:${event.errorCode}`, {
              defaultValue: event.errorCode,
            })
          : tRef.current("terminal:status.failed"));

      void notifySessionFailure(
        tRef.current("terminal:notifications.connectionFailed", {
          session: label,
        }),
        message,
      );
    });
  }, []);

  return null;
}

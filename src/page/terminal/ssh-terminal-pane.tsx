import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import {
  BrowserClipboardProvider,
  ClipboardAddon,
} from "@xterm/addon-clipboard";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useConnectionStore } from "@/stores/connection-store";
import { useSessionStore } from "@/stores/session-store";
import {
  closeSession as closeBackendSession,
  onTerminalData,
  onTerminalExit,
  resizeTerminal,
  writeTerminal,
} from "@/lib/tauri-terminal";
import {
  onSessionStatus,
  openSshTerminal,
  profileToSshRequest,
  reconnectSshTerminal,
  trustSshHostKey,
} from "@/lib/tauri-ssh";
import { useTerminalTheme } from "@/hooks/use-terminal-theme";
import { getTerminalThemeSnapshot } from "@/lib/terminal-theme-bridge";
import {
  buildTabLabel,
  extractOsc7Cwd,
  profileTabLabel,
} from "@/lib/session-display";
import { applyTerminalFont, applyTerminalTheme } from "@/lib/apply-terminal-appearance";
import { buildTerminalOptions } from "@/lib/terminal-options";
import { registerTerminal, unregisterTerminal } from "@/lib/terminal-registry";
import { trackTerminalCommandInput } from "@/lib/track-terminal-command";
import { useCommandOutlineStore } from "@/stores/command-outline-store";
import { bindTerminalBell } from "@/lib/terminal-bell";
import { bindCopyOnSelect } from "@/lib/terminal-copy-on-select";
import { RECONNECT_SESSION_EVENT } from "@/lib/reconnect-session";
import { useSessionPrivilegesStore } from "@/stores/session-privileges-store";
import { useShellUiStore } from "@/stores/shell-ui-store";
import {
  resolveConnectionCredential,
  takeConnectionSecrets,
} from "@/lib/resolve-connection-credential";
import { closeSftpExplorerSession } from "@/lib/sftp-explorer-session";
import { HostKeyDialog } from "@/components/ssh/host-key-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HostKeyPrompt } from "@/lib/puck-error";

type SshTerminalPaneProps = {
  sessionId: string;
  profileId?: string;
  active: boolean;
  focused?: boolean;
  layout?: "stack" | "pane";
};

export function SshTerminalPane({
  sessionId,
  profileId,
  active,
  focused: focusedProp,
  layout = "stack",
}: SshTerminalPaneProps) {
  const focused = focusedProp ?? active;
  const { t } = useTranslation(["terminal", "errors"]);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const openedRef = useRef(false);
  const [hostKeyPrompt, setHostKeyPrompt] = useState<HostKeyPrompt | null>(
    null,
  );
  const [pendingConnect, setPendingConnect] = useState<{
    cols: number;
    rows: number;
  } | null>(null);
  const profile = useConnectionStore((state) =>
    profileId ? state.getProfile(profileId) : undefined,
  );
  const fontFamily = useAppSettingsStore((state) => state.fontFamily);
  const fontSize = useAppSettingsStore((state) => state.fontSize);
  const cursorBlink = useAppSettingsStore((state) => state.cursorBlink);
  const scrollback = useAppSettingsStore((state) => state.scrollback);
  const copyOnSelect = useAppSettingsStore((state) => state.copyOnSelect);
  const terminalTheme = useTerminalTheme();
  const updateSessionStatus = useSessionStore(
    (state) => state.updateSessionStatus,
  );
  const updateSessionMeta = useSessionStore((state) => state.updateSessionMeta);
  const removeSession = useSessionStore((state) => state.closeSession);
  const sessionStatus = useSessionStore((state) =>
    state.sessions.find((item) => item.id === sessionId)?.status,
  );
  const sessionPrivileges = useSessionPrivilegesStore(
    (state) => state.bySessionId[sessionId],
  );

  const tRef = useRef(t);
  tRef.current = t;
  const commandInputRef = useRef({ buffer: "" });

  const connect = async (cols: number, rows: number) => {
    if (!profile) {
      updateSessionStatus(sessionId, "failed");
      return;
    }
    updateSessionStatus(sessionId, "creating");

    let secrets = takeConnectionSecrets(profile.id);
    if (profile.askPasswordEachTime) {
      const resolved = await resolveConnectionCredential(profile);
      if (resolved === null) {
        updateSessionStatus(sessionId, "failed");
        return;
      }
      secrets = resolved;
    }

    void openSshTerminal({
      ...profileToSshRequest(sessionId, profile, cols, rows),
      ...secrets,
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !profile) return;

    const terminal = new Terminal(
      buildTerminalOptions(
        { fontFamily, fontSize, cursorBlink, scrollback, copyOnSelect },
        getTerminalThemeSnapshot(),
      ),
    );
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(
      new ClipboardAddon(undefined, new BrowserClipboardProvider()),
    );
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(searchAddon);
    terminal.open(container);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    registerTerminal(sessionId, terminal, searchAddon);

    const dataDisposable = terminal.onData((data) => {
      trackTerminalCommandInput(sessionId, terminal, data, commandInputRef.current);
      void writeTerminal(sessionId, data);
    });
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      if (openedRef.current) {
        void resizeTerminal(sessionId, cols, rows);
      }
    });

    let unlistenData: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;
    let disposed = false;

    void (async () => {
      unlistenData = await onTerminalData((event) => {
        if (event.sessionId !== sessionId || disposed) return;
        terminal.write(event.data);

        const osc7 = extractOsc7Cwd(event.data);
        if (osc7 && profile) {
          updateSessionMeta(sessionId, {
            cwd: osc7.cwd,
            tabLabel: buildTabLabel(
              profile.username || "user",
              osc7.hostname || profile.host || "host",
              osc7.cwd,
            ),
          });
        }
      });
      unlistenExit = await onTerminalExit((event) => {
        if (event.sessionId !== sessionId || disposed) return;
        disposed = true;
        openedRef.current = false;
        removeSession(sessionId);
        void closeBackendSession(sessionId);
      });
      unlistenStatus = await onSessionStatus((event) => {
        if (event.sessionId !== sessionId || disposed) return;
        if (event.errorCode === "host_key_unknown" && event.hostKey) {
          useShellUiStore.getState().showSessionPanel();
          setHostKeyPrompt(event.hostKey);
          setPendingConnect({
            cols: Math.max(terminal.cols, 2),
            rows: Math.max(terminal.rows, 2),
          });
          updateSessionStatus(sessionId, "creating");
          return;
        }
        if (
          event.status === "connected" ||
          event.status === "failed" ||
          event.status === "disconnected" ||
          event.status === "reconnecting"
        ) {
          updateSessionStatus(
            sessionId,
            event.status as "connected" | "failed" | "disconnected" | "reconnecting",
          );
        }
        if (event.status === "connected") {
          openedRef.current = true;
          if (profile) {
            updateSessionMeta(sessionId, {
              shellName: "ssh",
              tabLabel: profileTabLabel(profile),
            });
          }
        }
        if (event.status === "failed") {
          openedRef.current = false;
          if (event.message) {
            const payload = {
              code: event.errorCode ?? "unknown_error",
              message: event.message,
            };
            terminalRef.current?.writeln(
              `\r\n${tRef.current(`errors:${payload.code}`, { defaultValue: payload.message })}\r\n`,
            );
          }
        }
      });

      fitAddon.fit();
      connect(Math.max(terminal.cols, 2), Math.max(terminal.rows, 2));
    })();

    const resizeObserver = new ResizeObserver(() => {
      if (!openedRef.current) return;
      fitAddon.fit();
      void resizeTerminal(sessionId, terminal.cols, terminal.rows);
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      unlistenData?.();
      unlistenExit?.();
      unlistenStatus?.();
      if (!disposed) {
        void closeBackendSession(sessionId);
      }
      void closeSftpExplorerSession(sessionId);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      openedRef.current = false;
      unregisterTerminal(sessionId);
      commandInputRef.current.buffer = "";
      useCommandOutlineStore.getState().removeSession(sessionId);
    };
  }, [
    profile,
    profileId,
    sessionId,
    removeSession,
    updateSessionMeta,
    updateSessionStatus,
  ]);

  useEffect(() => {
    if (!openedRef.current) return;
    const terminal = terminalRef.current;
    if (!terminal) return;

    requestAnimationFrame(() => {
      if (terminalRef.current !== terminal) return;
      applyTerminalTheme({ terminal, theme: terminalTheme });
    });
  }, [terminalTheme]);

  useEffect(() => {
    if (!openedRef.current) return;
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.cursorBlink = cursorBlink;
    terminal.options.scrollback = scrollback;
  }, [cursorBlink, scrollback]);

  useEffect(() => {
    if (!active || !openedRef.current) return;
    const terminal = terminalRef.current;
    if (!terminal) return;

    const disposable = bindTerminalBell(terminal, sessionPrivileges);
    return () => disposable.dispose();
  }, [active, sessionPrivileges]);

  useEffect(() => {
    if (!active || !openedRef.current) return;
    const terminal = terminalRef.current;
    if (!terminal) return;

    const disposable = bindCopyOnSelect(terminal, copyOnSelect);
    return () => disposable.dispose();
  }, [active, copyOnSelect]);

  useEffect(() => {
    if (!openedRef.current) return;
    const terminal = terminalRef.current;
    if (!terminal) return;
    applyTerminalFont({
      terminal,
      fitAddon: fitAddonRef.current,
      fontFamily,
      fontSize,
      onResize: (cols, rows) => {
        void resizeTerminal(sessionId, cols, rows);
      },
    });
  }, [fontFamily, fontSize, sessionId]);

  useEffect(() => {
    if (!focused || !openedRef.current) return;
    const fitAddon = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (!fitAddon || !terminal) return;
    requestAnimationFrame(() => {
      if (terminal.rows <= 0) return;
      fitAddon.fit();
      void resizeTerminal(sessionId, terminal.cols, terminal.rows);
    });
  }, [focused, sessionId]);

  const handleTrustHostKey = async () => {
    if (!hostKeyPrompt) return;
    await trustSshHostKey(hostKeyPrompt);
    setHostKeyPrompt(null);
    const terminal = terminalRef.current;
    const cols = pendingConnect?.cols ?? Math.max(terminal?.cols ?? 80, 2);
    const rows = pendingConnect?.rows ?? Math.max(terminal?.rows ?? 24, 2);
    connect(cols, rows);
    setPendingConnect(null);
  };

  const handleReconnect = () => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;
    fitAddon.fit();
    const cols = Math.max(terminal.cols, 2);
    const rows = Math.max(terminal.rows, 2);

    if (profile?.askPasswordEachTime) {
      void connect(cols, rows);
      return;
    }

    void reconnectSshTerminal(sessionId, cols, rows).catch(() => {
      void connect(cols, rows);
    });
  };
  const handleReconnectRef = useRef(handleReconnect);
  handleReconnectRef.current = handleReconnect;

  useEffect(() => {
    const onReconnect = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string }>).detail;
      if (detail.sessionId !== sessionId) return;
      handleReconnectRef.current();
    };

    window.addEventListener(RECONNECT_SESSION_EVENT, onReconnect);
    return () => window.removeEventListener(RECONNECT_SESSION_EVENT, onReconnect);
  }, [sessionId]);

  return (
    <div
      className={cn(
        layout === "stack"
          ? "absolute inset-0 flex min-h-0 flex-col"
          : "flex h-full min-h-0 flex-col",
        !active && "pointer-events-none invisible",
      )}
    >
      {(sessionStatus === "disconnected" || sessionStatus === "failed") && (
        <div className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {sessionStatus === "failed"
              ? t("terminal:status.failed")
              : t("terminal:status.disconnected")}
          </span>
          <Button size="sm" variant="outline" onClick={handleReconnect}>
            {t("terminal:actions.reconnect")}
          </Button>
        </div>
      )}
      <div className="xterm-host min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <HostKeyDialog
        open={Boolean(hostKeyPrompt)}
        prompt={hostKeyPrompt}
        onConfirm={() => void handleTrustHostKey()}
        onCancel={() => {
          setHostKeyPrompt(null);
          setPendingConnect(null);
          updateSessionStatus(sessionId, "failed");
        }}
      />
    </div>
  );
}

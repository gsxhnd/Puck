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
import {
  buildTabLabel,
  extractOsc7Cwd,
  profileTabLabel,
} from "@/lib/session-display";
import { isHostKeyError, parsePuckError } from "@/lib/puck-error";
import { applyTerminalFont, applyTerminalTheme } from "@/lib/apply-terminal-appearance";
import { registerTerminal, unregisterTerminal } from "@/lib/terminal-registry";
import { trackTerminalCommandInput } from "@/lib/track-terminal-command";
import { useCommandOutlineStore } from "@/stores/command-outline-store";
import { bindTerminalBell } from "@/lib/terminal-bell";
import { useSessionPrivilegesStore } from "@/stores/session-privileges-store";
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
    try {
      await openSshTerminal(profileToSshRequest(sessionId, profile, cols, rows));
      openedRef.current = true;
      updateSessionStatus(sessionId, "connected");
      updateSessionMeta(sessionId, {
        shellName: "ssh",
        tabLabel: profileTabLabel(profile),
      });
    } catch (error) {
      const hostKey = isHostKeyError(error);
      if (hostKey) {
        setHostKeyPrompt(hostKey);
        setPendingConnect({ cols, rows });
        updateSessionStatus(sessionId, "creating");
        return;
      }
      updateSessionStatus(sessionId, "failed");
      const payload = parsePuckError(error);
      terminalRef.current?.writeln(
        `\r\n${tRef.current(`errors:${payload.code}`, { defaultValue: payload.message })}\r\n`,
      );
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !profile) return;

    const terminal = new Terminal({
      fontFamily,
      fontSize,
      theme: terminalTheme,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
    });
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
      });

      fitAddon.fit();
      await connect(Math.max(terminal.cols, 2), Math.max(terminal.rows, 2));
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
    applyTerminalTheme({ terminal, theme: terminalTheme });
  }, [active, terminalTheme]);

  useEffect(() => {
    if (!active || !openedRef.current) return;
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
  }, [active, fontFamily, fontSize, sessionId]);

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
    if (!hostKeyPrompt || !pendingConnect) return;
    await trustSshHostKey(hostKeyPrompt);
    setHostKeyPrompt(null);
    await connect(pendingConnect.cols, pendingConnect.rows);
    setPendingConnect(null);
  };

  const handleReconnect = () => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;
    fitAddon.fit();
    void reconnectSshTerminal(sessionId, terminal.cols, terminal.rows);
  };

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
      <div ref={containerRef} className="min-h-0 flex-1" />
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

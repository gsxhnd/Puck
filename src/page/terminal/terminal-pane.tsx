import { useEffect, useRef } from "react";
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
import { useSessionStore } from "@/stores/session-store";
import {
  closeSession as closeBackendSession,
  getSystemIdentity,
  onTerminalData,
  onTerminalExit,
  openLocalTerminal,
  resizeTerminal,
  writeTerminal,
} from "@/lib/tauri-terminal";
import { buildTabLabel, extractOsc7Cwd } from "@/lib/session-display";
import { useTerminalTheme } from "@/hooks/use-terminal-theme";
import { cn } from "@/lib/utils";

type TerminalPaneProps = {
  sessionId: string;
  shellId?: string;
  active: boolean;
};

export function TerminalPane({ sessionId, shellId, active }: TerminalPaneProps) {
  const { t } = useTranslation("terminal");
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const openedRef = useRef(false);
  const fontFamily = useAppSettingsStore((state) => state.fontFamily);
  const fontSize = useAppSettingsStore((state) => state.fontSize);
  const terminalTheme = useTerminalTheme();
  const updateSessionStatus = useSessionStore(
    (state) => state.updateSessionStatus,
  );
  const updateSessionMeta = useSessionStore((state) => state.updateSessionMeta);
  const removeSession = useSessionStore((state) => state.closeSession);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      fontFamily,
      fontSize,
      theme: terminalTheme,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(
      new ClipboardAddon(undefined, new BrowserClipboardProvider()),
    );
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new SearchAddon());
    terminal.open(container);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const dataDisposable = terminal.onData((data) => {
      void writeTerminal(sessionId, data);
    });

    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      if (openedRef.current) {
        void resizeTerminal(sessionId, cols, rows);
      }
    });

    let unlistenData: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let disposed = false;

    const fitTerminal = () => {
      fitAddon.fit();
      return { cols: terminal.cols, rows: terminal.rows };
    };

    void (async () => {
      updateSessionStatus(sessionId, "creating");
      const identity = await getSystemIdentity();

      const unlistenDataFn = await onTerminalData((event) => {
        if (event.sessionId !== sessionId || disposed) return;
        terminal.write(event.data);

        const osc7 = extractOsc7Cwd(event.data);
        if (osc7) {
          updateSessionMeta(sessionId, {
            cwd: osc7.cwd,
            tabLabel: buildTabLabel(
              identity.username,
              osc7.hostname || identity.hostname,
              osc7.cwd,
            ),
          });
        }
      });
      const unlistenExitFn = await onTerminalExit((event) => {
        if (event.sessionId !== sessionId || disposed) return;
        disposed = true;
        openedRef.current = false;
        removeSession(sessionId);
        void closeBackendSession(sessionId);
      });

      if (disposed) {
        unlistenDataFn();
        unlistenExitFn();
        return;
      }

      unlistenData = unlistenDataFn;
      unlistenExit = unlistenExitFn;

      const { cols, rows } = fitTerminal();

      try {
        const result = await openLocalTerminal({
          sessionId,
          shellId,
          cols: Math.max(cols, 2),
          rows: Math.max(rows, 2),
        });
        openedRef.current = true;
        updateSessionStatus(sessionId, "connected");
        updateSessionMeta(sessionId, {
          shellName: result.shell.kind,
          tabLabel: buildTabLabel(identity.username, identity.hostname, "~"),
        });
      } catch {
        updateSessionStatus(sessionId, "failed");
        terminal.writeln(`\r\n${t("openFailed")}\r\n`);
      }
    })();

    const resizeObserver = new ResizeObserver(() => {
      if (!openedRef.current) return;
      fitTerminal();
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
      if (!disposed) {
        void closeBackendSession(sessionId);
      }
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      openedRef.current = false;
    };
  }, [
    sessionId,
    shellId,
    t,
    removeSession,
    updateSessionMeta,
    updateSessionStatus,
  ]);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal) return;
    terminal.options.theme = { ...terminalTheme };
    terminal.options.fontFamily = fontFamily;
    terminal.options.fontSize = fontSize;
    terminal.refresh(0, terminal.rows - 1);
    if (fitAddon && openedRef.current) {
      requestAnimationFrame(() => {
        fitAddon.fit();
        void resizeTerminal(sessionId, terminal.cols, terminal.rows);
      });
    }
  }, [fontFamily, fontSize, terminalTheme, sessionId]);

  useEffect(() => {
    if (!active || !openedRef.current) return;
    const fitAddon = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (!fitAddon || !terminal) return;

    requestAnimationFrame(() => {
      fitAddon.fit();
      void resizeTerminal(sessionId, terminal.cols, terminal.rows);
    });
  }, [active, sessionId]);

  return (
    <div
      className={cn(
        "absolute inset-0 min-h-0",
        !active && "pointer-events-none invisible",
      )}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

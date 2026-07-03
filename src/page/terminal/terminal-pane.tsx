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
import { applyTerminalFont, applyTerminalTheme } from "@/lib/apply-terminal-appearance";
import { buildTerminalOptions } from "@/lib/terminal-options";
import { registerTerminal, unregisterTerminal } from "@/lib/terminal-registry";
import { trackTerminalCommandInput } from "@/lib/track-terminal-command";
import { bindTerminalBell } from "@/lib/terminal-bell";
import { bindCopyOnSelect } from "@/lib/terminal-copy-on-select";
import { useSessionPrivilegesStore } from "@/stores/session-privileges-store";
import { useCommandOutlineStore } from "@/stores/command-outline-store";
import { useTerminalTheme } from "@/hooks/use-terminal-theme";
import { getTerminalThemeSnapshot } from "@/lib/terminal-theme-bridge";
import { cn } from "@/lib/utils";

type TerminalPaneProps = {
  sessionId: string;
  shellId?: string;
  active: boolean;
  focused?: boolean;
  layout?: "stack" | "pane";
};

export function TerminalPane({
  sessionId,
  shellId,
  active,
  focused: focusedProp,
  layout = "stack",
}: TerminalPaneProps) {
  const focused = focusedProp ?? active;
  const { t } = useTranslation("terminal");
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const openedRef = useRef(false);
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
  const sessionPrivileges = useSessionPrivilegesStore(
    (state) => state.bySessionId[sessionId],
  );

  const tRef = useRef(t);
  tRef.current = t;
  const commandInputRef = useRef({ buffer: "" });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
    applyTerminalTheme({ terminal, theme: getTerminalThemeSnapshot() });

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
        terminal.writeln(`\r\n${tRef.current("openFailed")}\r\n`);
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
      if (openedRef.current) {
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
  }, [sessionId, shellId, removeSession, updateSessionMeta, updateSessionStatus]);

  useEffect(() => {
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

  return (
    <div
      className={cn(
        layout === "stack" ? "absolute inset-0 min-h-0" : "h-full min-h-0",
        !active && "pointer-events-none invisible",
      )}
    >
      <div className="xterm-host">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}

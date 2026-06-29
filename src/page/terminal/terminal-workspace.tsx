import { useSessionStore } from "@/stores/session-store";
import { useTerminalSplitStore } from "@/stores/terminal-split-store";
import { TerminalPane } from "@/page/terminal/terminal-pane";
import { SshTerminalPane } from "@/page/terminal/ssh-terminal-pane";
import { FileManager } from "@/page/files/file-manager";
import { TerminalSearchBar } from "@/page/terminal/terminal-search-bar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

type TerminalWorkspaceProps = {
  activeSessionId: string | null;
};

function SessionPane({
  sessionId,
  visible,
  focused,
  layout,
}: {
  sessionId: string;
  visible: boolean;
  focused: boolean;
  layout: "stack" | "pane";
}) {
  const session = useSessionStore((state) =>
    state.sessions.find((item) => item.id === sessionId),
  );

  if (!session) {
    return null;
  }

  if (session.kind === "files") {
    return (
      <FileManager
        sessionId={session.id}
        profileId={session.profileId}
        active={visible}
        focused={focused}
        layout={layout}
      />
    );
  }

  if (session.protocol === "ssh") {
    return (
      <SshTerminalPane
        sessionId={session.id}
        profileId={session.profileId}
        active={visible}
        focused={focused}
        layout={layout}
      />
    );
  }

  return (
    <TerminalPane
      sessionId={session.id}
      shellId={session.shellId}
      active={visible}
      focused={focused}
      layout={layout}
    />
  );
}

export function TerminalWorkspace({ activeSessionId }: TerminalWorkspaceProps) {
  const sessions = useSessionStore((state) => state.sessions);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const splitLayout = useTerminalSplitStore((state) => state.layout);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const showSearch = activeSession?.kind === "terminal";

  if (
    splitLayout &&
    activeSession?.kind === "terminal" &&
    splitLayout.paneSessionIds.every((id) =>
      sessions.some((session) => session.id === id),
    )
  ) {
    return (
      <div className="relative h-full min-h-0 flex-1 overflow-hidden">
        {showSearch ? <TerminalSearchBar /> : null}
        <ResizablePanelGroup
          orientation={splitLayout.orientation}
          className="h-full"
        >
          <ResizablePanel
            id={splitLayout.paneSessionIds[0]}
            defaultSize={50}
            minSize={15}
            className="min-h-0"
          >
            <div
              className="relative h-full min-h-0 overflow-hidden"
              onPointerDown={() =>
                setActiveSession(splitLayout.paneSessionIds[0])
              }
            >
              <SessionPane
                sessionId={splitLayout.paneSessionIds[0]}
                visible
                focused={splitLayout.paneSessionIds[0] === activeSessionId}
                layout="pane"
              />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            id={splitLayout.paneSessionIds[1]}
            defaultSize={50}
            minSize={15}
            className="min-h-0"
          >
            <div
              className="relative h-full min-h-0 overflow-hidden"
              onPointerDown={() =>
                setActiveSession(splitLayout.paneSessionIds[1])
              }
            >
              <SessionPane
                sessionId={splitLayout.paneSessionIds[1]}
                visible
                focused={splitLayout.paneSessionIds[1] === activeSessionId}
                layout="pane"
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {sessions
          .filter(
            (session) => !splitLayout.paneSessionIds.includes(session.id),
          )
          .map((session) => (
            <SessionPane
              key={session.id}
              sessionId={session.id}
              visible={false}
              focused={false}
              layout="stack"
            />
          ))}
      </div>
    );
  }

  const localTerminalSessions = sessions.filter(
    (session) =>
      session.kind === "terminal" &&
      (!session.protocol || session.protocol === "local"),
  );
  const sshTerminalSessions = sessions.filter(
    (session) => session.kind === "terminal" && session.protocol === "ssh",
  );
  const fileSessions = sessions.filter((session) => session.kind === "files");

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {showSearch ? <TerminalSearchBar /> : null}
      {localTerminalSessions.map((session) => (
        <TerminalPane
          key={session.id}
          sessionId={session.id}
          shellId={session.shellId}
          active={session.id === activeSessionId}
          focused={session.id === activeSessionId}
          layout="stack"
        />
      ))}

      {sshTerminalSessions.map((session) => (
        <SshTerminalPane
          key={session.id}
          sessionId={session.id}
          profileId={session.profileId}
          active={session.id === activeSessionId}
          focused={session.id === activeSessionId}
          layout="stack"
        />
      ))}

      {fileSessions.map((session) => (
        <FileManager
          key={session.id}
          sessionId={session.id}
          profileId={session.profileId}
          active={session.id === activeSessionId}
          focused={session.id === activeSessionId}
          layout="stack"
        />
      ))}
    </div>
  );
}

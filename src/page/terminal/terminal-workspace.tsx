import { useSessionStore } from "@/stores/session-store";
import { useTerminalSplitStore } from "@/stores/terminal-split-store";
import { TerminalPane } from "@/page/terminal/terminal-pane";
import { SshTerminalPane } from "@/page/terminal/ssh-terminal-pane";
import { FileManager } from "@/page/files/file-manager";
import { TerminalSearchBar } from "@/page/terminal/terminal-search-bar";
import {
  collectPaneSessionIds,
  layoutContainsSession,
  splitNodePanelId,
  type SplitNode,
} from "@/types/terminal-split";
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

function SplitTree({
  node,
  activeSessionId,
  onFocusPane,
}: {
  node: SplitNode;
  activeSessionId: string | null;
  onFocusPane: (sessionId: string) => void;
}) {
  if (node.type === "pane") {
    return (
      <div
        className="relative h-full min-h-0 overflow-hidden"
        onPointerDown={() => onFocusPane(node.sessionId)}
      >
        <SessionPane
          sessionId={node.sessionId}
          visible
          focused={node.sessionId === activeSessionId}
          layout="pane"
        />
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation={node.orientation}
      className="h-full"
    >
      <ResizablePanel
        id={splitNodePanelId(node.first)}
        defaultSize={50}
        minSize={15}
        className="min-h-0"
      >
        <SplitTree
          node={node.first}
          activeSessionId={activeSessionId}
          onFocusPane={onFocusPane}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        id={splitNodePanelId(node.second)}
        defaultSize={50}
        minSize={15}
        className="min-h-0"
      >
        <SplitTree
          node={node.second}
          activeSessionId={activeSessionId}
          onFocusPane={onFocusPane}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function TerminalWorkspace({ activeSessionId }: TerminalWorkspaceProps) {
  const sessions = useSessionStore((state) => state.sessions);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const splitLayout = useTerminalSplitStore((state) => state.layout);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const showSearch = activeSession?.kind === "terminal";

  const splitPaneIds =
    splitLayout != null ? collectPaneSessionIds(splitLayout.root) : [];

  if (
    splitLayout &&
    activeSession?.kind === "terminal" &&
    layoutContainsSession(splitLayout, activeSession.id) &&
    splitPaneIds.every((id) => sessions.some((session) => session.id === id))
  ) {
    return (
      <div className="relative h-full min-h-0 flex-1 overflow-hidden">
        {showSearch ? <TerminalSearchBar /> : null}
        <SplitTree
          node={splitLayout.root}
          activeSessionId={activeSessionId}
          onFocusPane={setActiveSession}
        />

        {sessions
          .filter((session) => !splitPaneIds.includes(session.id))
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

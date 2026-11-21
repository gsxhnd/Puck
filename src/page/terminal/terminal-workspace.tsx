/**
 * Terminal-only workspace rendering with optional split layout.
 *
 * 终端区域渲染：支持当前 Workspace 的本地 / SSH 终端栈与两窗格分屏。文件浏览
 * 已迁移到 Workspace Explorer，不再作为终端 Session 类型存在。
 */
import { useSessionStore } from "@/stores/session-store";
import { useTerminalSplitStore } from "@/stores/terminal-split-store";
import { TerminalPane } from "@/page/terminal/terminal-pane";
import { SshTerminalPane } from "@/page/terminal/ssh-terminal-pane";
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
  /** Restrict the rendered stack and split tree to one workspace. */
  workspaceId?: string;
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

  if (!session || session.kind !== "terminal") {
    return null;
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
    <ResizablePanelGroup orientation={node.orientation} className="h-full">
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

export function TerminalWorkspace({
  activeSessionId,
  workspaceId,
}: TerminalWorkspaceProps) {
  const allSessions = useSessionStore((state) => state.sessions);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const splitLayout = useTerminalSplitStore((state) => state.layout);
  const sessions = allSessions.filter(
    (session) =>
      session.kind === "terminal" &&
      (workspaceId
        ? workspaceId === "__unscoped__"
          ? !session.workspaceId
          : session.workspaceId === workspaceId
        : true),
  );

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const splitPaneIds =
    splitLayout != null ? collectPaneSessionIds(splitLayout.root) : [];

  if (
    splitLayout &&
    activeSession &&
    layoutContainsSession(splitLayout, activeSession.id) &&
    splitPaneIds.every((id) => sessions.some((session) => session.id === id))
  ) {
    return (
      <div className="relative h-full min-h-0 flex-1 overflow-hidden">
        <TerminalSearchBar />
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

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <TerminalSearchBar />
      {sessions.map((session) =>
        session.protocol === "ssh" ? (
          <SshTerminalPane
            key={session.id}
            sessionId={session.id}
            profileId={session.profileId}
            active={session.id === activeSessionId}
            focused={session.id === activeSessionId}
            layout="stack"
          />
        ) : (
          <TerminalPane
            key={session.id}
            sessionId={session.id}
            shellId={session.shellId}
            active={session.id === activeSessionId}
            focused={session.id === activeSessionId}
            layout="stack"
          />
        ),
      )}
    </div>
  );
}

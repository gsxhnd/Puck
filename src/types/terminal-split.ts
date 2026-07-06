export type TerminalSplitDirection = "right" | "left" | "down" | "up";

export type SplitPaneNode = {
  type: "pane";
  sessionId: string;
};

export type SplitBranchNode = {
  type: "branch";
  orientation: "horizontal" | "vertical";
  first: SplitNode;
  second: SplitNode;
};

export type SplitNode = SplitPaneNode | SplitBranchNode;

export type TerminalSplitLayout = {
  /** Session id shown in the sidebar tab strip. */
  tabSessionId: string;
  root: SplitNode;
};

export function splitOrientation(
  direction: TerminalSplitDirection,
): SplitBranchNode["orientation"] {
  return direction === "down" || direction === "up" ? "vertical" : "horizontal";
}

export function splitPaneOrder(
  sourceSessionId: string,
  newSessionId: string,
  direction: TerminalSplitDirection,
): [string, string] {
  if (direction === "left" || direction === "up") {
    return [newSessionId, sourceSessionId];
  }
  return [sourceSessionId, newSessionId];
}

export function paneNode(sessionId: string): SplitPaneNode {
  return { type: "pane", sessionId };
}

export function branchNode(
  direction: TerminalSplitDirection,
  sourceSessionId: string,
  newSessionId: string,
): SplitBranchNode {
  const [firstId, secondId] = splitPaneOrder(
    sourceSessionId,
    newSessionId,
    direction,
  );
  return {
    type: "branch",
    orientation: splitOrientation(direction),
    first: paneNode(firstId),
    second: paneNode(secondId),
  };
}

export function collectPaneSessionIds(node: SplitNode): string[] {
  if (node.type === "pane") {
    return [node.sessionId];
  }
  return [
    ...collectPaneSessionIds(node.first),
    ...collectPaneSessionIds(node.second),
  ];
}

export function layoutContainsSession(
  layout: TerminalSplitLayout,
  sessionId: string,
): boolean {
  return collectPaneSessionIds(layout.root).includes(sessionId);
}

export function splitPaneInTree(
  node: SplitNode,
  sourceSessionId: string,
  direction: TerminalSplitDirection,
  newSessionId: string,
): SplitNode {
  if (node.type === "pane") {
    if (node.sessionId !== sourceSessionId) {
      return node;
    }
    return branchNode(direction, sourceSessionId, newSessionId);
  }

  const first = splitPaneInTree(
    node.first,
    sourceSessionId,
    direction,
    newSessionId,
  );
  const second = splitPaneInTree(
    node.second,
    sourceSessionId,
    direction,
    newSessionId,
  );

  if (first === node.first && second === node.second) {
    return node;
  }

  return {
    type: "branch",
    orientation: node.orientation,
    first,
    second,
  };
}

export function pruneSplitTree(
  node: SplitNode,
  activeIds: Set<string>,
): SplitNode | null {
  if (node.type === "pane") {
    return activeIds.has(node.sessionId) ? node : null;
  }

  const first = pruneSplitTree(node.first, activeIds);
  const second = pruneSplitTree(node.second, activeIds);

  if (!first && !second) {
    return null;
  }
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }

  return {
    type: "branch",
    orientation: node.orientation,
    first,
    second,
  };
}

export function splitNodePanelId(node: SplitNode): string {
  return collectPaneSessionIds(node).join(":");
}

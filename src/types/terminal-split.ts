export type TerminalSplitDirection = "right" | "left" | "down" | "up";

export type TerminalSplitLayout = {
  orientation: "horizontal" | "vertical";
  paneSessionIds: [string, string];
};

export function splitOrientation(
  direction: TerminalSplitDirection,
): TerminalSplitLayout["orientation"] {
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

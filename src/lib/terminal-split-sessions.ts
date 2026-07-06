/**
 * Helpers for hiding split pane sessions from the tab list and closing split groups.
 *
 * 分屏辅助函数：将分屏子窗格从侧栏标签列表中隐藏，并统一关闭整个分屏组。
 */
import { useSessionStore } from "@/stores/session-store";
import { useTerminalSplitStore } from "@/stores/terminal-split-store";
import {
  collectPaneSessionIds,
  layoutContainsSession,
  type TerminalSplitLayout,
} from "@/types/terminal-split";

/** Session ids for split panes that should not appear as their own tab. */
export function getSplitHiddenSessionIds(
  layout: TerminalSplitLayout | null,
): Set<string> {
  if (!layout) {
    return new Set();
  }

  const paneIds = collectPaneSessionIds(layout.root);
  return new Set(paneIds.filter((id) => id !== layout.tabSessionId));
}

/** Keep only sessions that should appear in the sidebar tab strip. */
export function filterTabVisibleSessions<T extends { id: string }>(
  sessions: T[],
  layout: TerminalSplitLayout | null,
): T[] {
  const hidden = getSplitHiddenSessionIds(layout);
  if (hidden.size === 0) {
    return sessions;
  }

  return sessions.filter((session) => !hidden.has(session.id));
}

/** Whether a sidebar tab should look active for the current focused pane. */
export function isSplitTabActive(
  tabSessionId: string,
  activeSessionId: string | null,
  layout: TerminalSplitLayout | null,
): boolean {
  if (!activeSessionId) {
    return false;
  }

  if (activeSessionId === tabSessionId) {
    return true;
  }

  if (!layout || layout.tabSessionId !== tabSessionId) {
    return false;
  }

  return layoutContainsSession(layout, activeSessionId);
}

function getSplitPaneIdsForTab(
  tabSessionId: string,
  layout: TerminalSplitLayout | null,
): string[] {
  if (!layout || layout.tabSessionId !== tabSessionId) {
    return [tabSessionId];
  }

  return collectPaneSessionIds(layout.root);
}

/** Close a tab and every pane in its split group. */
export function closeSplitTab(tabSessionId: string): void {
  const layout = useTerminalSplitStore.getState().layout;
  const paneIds = getSplitPaneIdsForTab(tabSessionId, layout);
  const closeSession = useSessionStore.getState().closeSession;

  useTerminalSplitStore.getState().clearSplit();

  for (const id of paneIds) {
    closeSession(id);
  }
}

/** Close the active session; split trees are pruned via syncWithSessions. */
export function closeActiveSessionTab(activeSessionId: string | null): void {
  if (!activeSessionId) {
    return;
  }

  useSessionStore.getState().closeSession(activeSessionId);
}

/** Whether a session belongs to the current split group. */
export function isSessionInSplitLayout(
  sessionId: string,
  layout: TerminalSplitLayout | null,
): boolean {
  if (!layout) {
    return false;
  }
  return layoutContainsSession(layout, sessionId);
}

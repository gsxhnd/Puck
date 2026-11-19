/**
 * Core domain types for the workbench shell.
 *
 * 工作台核心领域类型：把 UI 标签（WorkbenchTab）、运行时后端资源与编辑器文档
 * （EditorDocumentMeta）拆分为三个独立概念，避免单一 Session 模型同时承载布局、
 * 资源与文档状态。这是重构计划（REFACTOR_PLAN.md）阶段 1「Workbench 基础」的类型层。
 */

/** Which backend an editor document lives on. / 编辑器文档所在端：本地文件系统或 SFTP 远程。 */
export type DocumentSource = "local" | "remote";

/** Which backend a remote desktop session talks to. / 远程桌面会话使用的图形协议。 */
export type RemoteDesktopProtocol = "rdp" | "vnc";

/**
 * Metadata for an editor document (never holds full text content).
 *
 * 编辑器文档元数据（不持有完整文本内容）。文本内容后续由 Monaco Model 与
 * 高亮 Worker 持有，这里只保存身份、来源与 UI 状态。
 */
export type EditorDocumentMeta = {
  documentId: string;
  source: DocumentSource;
  path: string;
  /** Owning SFTP session id for remote documents; absent for local files. 远程文档所属的 SFTP 会话 id；本地文档没有该字段。 */
  sessionId?: string;
  /** Monaco language id. / Monaco 语言 id。 */
  language: string;
  readOnly?: boolean;
};

/** Load lifecycle of a document. / 文档加载生命周期。 */
export type DocumentLoadState = "loading" | "ready" | "error";

/** A terminal tab bound to a runtime terminal session. / 绑定运行时终端会话的终端标签。 */
export type TerminalTab = {
  kind: "terminal";
  tabId: string;
  sessionId: string;
};

/** An editor tab bound to a document. / 绑定编辑器文档的编辑标签。 */
export type EditorTab = {
  kind: "editor";
  tabId: string;
  documentId: string;
};

/** A side-by-side diff tab between two texts. / 双栏文本对比的 Diff 标签。 */
export type DiffTab = {
  kind: "diff";
  tabId: string;
  title: string;
  original: string;
  modified: string;
  language: string;
};

/** A graphical remote desktop tab (RDP/VNC). / 图形远程桌面标签（RDP/VNC）。 */
export type RemoteDesktopTab = {
  kind: "remoteDesktop";
  tabId: string;
  sessionId: string;
  protocol: RemoteDesktopProtocol;
};

/** The welcome/start tab. / 欢迎起始页标签。 */
export type WelcomeTab = {
  kind: "welcome";
  tabId: string;
};

/** Discriminated union of every workbench center-area tab. / 工作台中央区所有标签的可辨识联合。 */
export type WorkbenchTab =
  | TerminalTab
  | EditorTab
  | DiffTab
  | RemoteDesktopTab
  | WelcomeTab;

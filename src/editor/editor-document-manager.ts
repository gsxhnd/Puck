/**
 * Registry and lifecycle manager for editor documents.
 *
 * 编辑器文档注册表与生命周期管理器。集中管理文档的加载、dirty 判定与保存，
 * React 组件只消费快照而不持有文本状态；这是把编辑器从「单文件窗口」迁移到
 * 「工作台多标签」的阶段 1 基础设施。文本内容当前由本管理器暂存；阶段 2 接入
 * Monaco Model 后，Model 将成为文本唯一持有者，本管理器只保留元数据与版本号。
 */
import type {
  DocumentLoadState,
  EditorDocumentMeta,
} from "@/types/workbench";
import { createDocumentIo, type DocumentIo } from "@/editor/document-io";

/** Immutable view of one document for React consumers. / 提供给 React 消费方的文档不可变快照。 */
export type EditorDocumentSnapshot = {
  meta: EditorDocumentMeta;
  loadState: DocumentLoadState;
  loadError?: string | undefined;
  saving: boolean;
  dirty: boolean;
  /**
   * Bumped on every content edit; later consumed by the tree-sitter worker to
   * drop stale highlight results.
   * 每次内容修改时递增；后续供 tree-sitter Worker 丢弃过期的高亮结果。
   */
  version: number;
  content: string;
};

type DocumentEntry = {
  meta: EditorDocumentMeta;
  io: DocumentIo;
  content: string;
  savedContent: string;
  loadState: DocumentLoadState;
  loadError?: string | undefined;
  saving: boolean;
  version: number;
};

function toSnapshot(entry: DocumentEntry): EditorDocumentSnapshot {
  return {
    meta: entry.meta,
    loadState: entry.loadState,
    loadError: entry.loadError,
    saving: entry.saving,
    dirty: entry.content !== entry.savedContent,
    version: entry.version,
    content: entry.content,
  };
}

class EditorDocumentManager {
  private readonly entries = new Map<string, DocumentEntry>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;

  /**
   * Subscribes to changes; returns an unsubscribe function. Intended for
   * `useSyncExternalStore` wiring in a later phase.
   * 订阅变更；返回取消订阅函数。后续阶段用于接入 `useSyncExternalStore`。
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Monotonic change counter for external store integration. / 单调递增的变更计数，供外部 store 集成使用。 */
  getRevision(): number {
    return this.revision;
  }

  /** Returns a snapshot for one document, or null when not registered. / 返回单个文档快照；未注册时返回 null。 */
  get(documentId: string): EditorDocumentSnapshot | null {
    const entry = this.entries.get(documentId);
    return entry ? toSnapshot(entry) : null;
  }

  /** Returns snapshots for every registered document. / 返回所有已注册文档的快照。 */
  list(): EditorDocumentSnapshot[] {
    return [...this.entries.values()].map(toSnapshot);
  }

  /** True when current content differs from the last saved content. / 当前内容与最近一次保存内容不一致时为 true。 */
  isDirty(documentId: string): boolean {
    const entry = this.entries.get(documentId);
    return entry ? entry.content !== entry.savedContent : false;
  }

  /** Registers a document and starts loading its content. / 注册文档并开始加载内容。 */
  async open(meta: EditorDocumentMeta): Promise<EditorDocumentSnapshot> {
    const documentId = meta.documentId;
    const existing = this.entries.get(documentId);
    if (existing) {
      return toSnapshot(existing);
    }

    const entry: DocumentEntry = {
      meta,
      io: createDocumentIo(meta.source, meta.sessionId),
      content: "",
      savedContent: "",
      loadState: "loading",
      saving: false,
      version: 0,
    };
    this.entries.set(documentId, entry);
    this.notify();

    try {
      const content = await entry.io.read(meta.path);
      // The document may have been closed and reopened while loading.
      // 加载期间文档可能已被关闭或重新打开，此时放弃写入旧 entry。
      if (this.entries.get(documentId) !== entry) {
        const live = this.entries.get(documentId);
        return live ? toSnapshot(live) : toSnapshot(entry);
      }
      entry.content = content;
      entry.savedContent = content;
      entry.loadState = "ready";
      entry.loadError = undefined;
      this.notify();
      return toSnapshot(entry);
    } catch (error) {
      if (this.entries.get(documentId) !== entry) {
        const live = this.entries.get(documentId);
        return live ? toSnapshot(live) : toSnapshot(entry);
      }
      entry.loadState = "error";
      entry.loadError = error instanceof Error ? error.message : String(error);
      this.notify();
      return toSnapshot(entry);
    }
  }

  /** Records an edit from the editor and bumps the version. / 记录编辑器的一次内容修改并递增版本号。 */
  markEdited(
    documentId: string,
    content: string,
  ): EditorDocumentSnapshot | null {
    const entry = this.entries.get(documentId);
    if (!entry || entry.loadState !== "ready") {
      return entry ? toSnapshot(entry) : null;
    }
    if (entry.content === content) {
      return toSnapshot(entry);
    }
    entry.content = content;
    entry.version += 1;
    this.notify();
    return toSnapshot(entry);
  }

  /**
   * Persists the current content. On failure the saved content is intentionally
   * left untouched so the document stays dirty, and the error is rethrown.
   * 持久化当前内容。失败时保留 savedContent 不变（文档保持 dirty），并把错误
   * 重新抛给调用方处理 UI 提示。
   */
  async save(documentId: string): Promise<EditorDocumentSnapshot> {
    const entry = this.entries.get(documentId);
    if (!entry) {
      throw new Error(`Document not found: ${documentId}`);
    }
    if (entry.loadState !== "ready") {
      throw new Error(`Document is not ready: ${documentId}`);
    }
    if (entry.saving) {
      return toSnapshot(entry);
    }

    entry.saving = true;
    this.notify();
    try {
      await entry.io.write(entry.meta.path, entry.content);
      entry.savedContent = entry.content;
    } finally {
      entry.saving = false;
      this.notify();
    }
    return toSnapshot(entry);
  }

  /**
   * Removes a document from the registry. Callers must check `isDirty` and
   * confirm with the user before calling this.
   * 从注册表移除文档。调用方必须先检查 `isDirty` 并与用户确认后再调用。
   */
  close(documentId: string): void {
    if (this.entries.delete(documentId)) {
      this.notify();
    }
  }

  private notify(): void {
    this.revision += 1;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

let manager: EditorDocumentManager | null = null;

/** Process-wide document manager singleton, mirroring Rust's SessionManager::global. / 进程级单例文档管理器，对应 Rust 侧的 SessionManager::global。 */
export function getEditorDocumentManager(): EditorDocumentManager {
  if (!manager) {
    manager = new EditorDocumentManager();
  }
  return manager;
}

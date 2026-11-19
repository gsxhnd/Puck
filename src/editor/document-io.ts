/**
 * Read/write adapters for editor documents.
 *
 * 编辑器文档的读写适配器。本地文件与 SFTP 远程文件共用同一套 Document 生命周期，
 * 传输差异通过 DocumentIo 注入；IPC 调用仍统一走 `src/lib/tauri-*.ts` 封装，
 * 不在组件内直接 invoke。
 */
import { readLocalFile, writeLocalFile } from "@/lib/tauri-workspace";
import { readRemoteFile, writeRemoteFile } from "@/lib/tauri-sftp";
import type { DocumentSource } from "@/types/workbench";

/** Transport-agnostic document IO. / 与传输协议无关的文档读写接口。 */
export type DocumentIo = {
  readonly source: DocumentSource;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
};

/** Local filesystem adapter backed by atomic-write commands. / 本地文件系统适配器，底层命令带原子写保护。 */
export function createLocalDocumentIo(): DocumentIo {
  return {
    source: "local",
    read: (path) => readLocalFile(path),
    write: (path, content) => writeLocalFile(path, content),
  };
}

/** SFTP adapter bound to one remote session. / 绑定单个远程会话的 SFTP 适配器。 */
export function createRemoteDocumentIo(sessionId: string): DocumentIo {
  return {
    source: "remote",
    read: (path) => readRemoteFile(sessionId, path),
    write: (path, content) => writeRemoteFile(sessionId, path, content),
  };
}

/** Creates the right adapter for a document source. / 按文档来源创建适配器；远程来源缺少会话 id 时抛错。 */
export function createDocumentIo(
  source: DocumentSource,
  sessionId?: string,
): DocumentIo {
  if (source === "remote") {
    if (!sessionId) {
      throw new Error("Remote document IO requires a sessionId");
    }
    return createRemoteDocumentIo(sessionId);
  }
  return createLocalDocumentIo();
}

/**
 * Registry for workbench diff tab contents.
 *
 * 工作台 Diff 标签的内容注册表。original/modified 两份对比文本与标签元数据
 * 分离存放（store 只保留元数据），通过 tab id 关联；内容由 openDiffTab 写入、
 * closeTab 清理。这是进程内内存态，不持久化。
 */

type DiffContent = {
  original: string;
  modified: string;
};

const contents = new Map<string, DiffContent>();

/** Stores both sides of a diff for the given tab id. / 保存指定标签 id 的对比文本。 */
export function setDiffContent(id: string, original: string, modified: string): void {
  contents.set(id, { original, modified });
}

/** Returns the diff content for a tab id, or null. / 读取指定标签 id 的对比文本；不存在时返回 null。 */
export function getDiffContent(id: string): DiffContent | null {
  return contents.get(id) ?? null;
}

/** Removes the diff content for a closed tab. / 清理已关闭标签的对比文本。 */
export function removeDiffContent(id: string): void {
  contents.delete(id);
}

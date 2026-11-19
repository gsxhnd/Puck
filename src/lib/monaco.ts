/**
 * Monaco loader for the standalone editor.
 *
 * Monaco 加载器。运行时使用 `editor.api.js + editor.all.js` 组合：包含全部
 * 编辑器功能（查找、折叠、括号匹配等），但不含 json/css/html/typescript
 * language service（即无 LSP/语义能力，也无对应 worker）；Monarch 语法高亮
 * 通过 monaco-basic-languages.ts 按需注册。类型从主入口 `monaco-editor` 获取
 * （import type 零运行时成本）；全项目统一经 loadMonaco() 获取实例，避免直接
 * import("monaco-editor") 把 editor.main（含语言服务）拉进产物。
 */
import type * as MonacoApi from "monaco-editor";

let monacoPromise: Promise<typeof MonacoApi> | null = null;

/** Loads the shared Monaco instance with editor features but no language services. / 加载共享 Monaco 实例：含编辑器功能、不含语言服务。 */
export function loadMonaco(): Promise<typeof MonacoApi> {
  if (!monacoPromise) {
    // All three imports are dynamic so Monaco (editor core + features +
    // Monarch tokenizers) stays out of the initial bundle.
    // 三者全部动态导入，确保 Monaco（编辑器核心 + 功能 + Monarch 语法）
    // 不进入首屏 bundle。
    monacoPromise = Promise.all([
      import("monaco-editor/esm/vs/editor/editor.api.js"),
      import("monaco-editor/esm/vs/editor/editor.all.js"),
      import("./monaco-basic-languages"),
    ]).then(([monaco]) => monaco as unknown as typeof MonacoApi);
  }
  return monacoPromise;
}

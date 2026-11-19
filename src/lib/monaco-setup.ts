/**
 * Monaco environment setup for the standalone editor.
 *
 * Monaco 环境配置。产品定位明确不支持 LSP 与语义语言服务，因此只保留基础
 * editor worker（负责文本模型与 diff 计算），不注册 json/css/html/typescript
 * language service worker——语法高亮由 Monarch tokenizer 提供（见
 * src/lib/monaco-basic-languages.ts）。
 */
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

let configured = false;

export function ensureMonacoEnvironment() {
  if (configured) return;
  configured = true;

  self.MonacoEnvironment = {
    getWorker() {
      return new editorWorker();
    },
  };
}

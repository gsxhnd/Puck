/**
 * Module declarations for Monaco ESM side-effect imports that ship without
 * type definitions.
 *
 * 为 Monaco ESM 副作用导入补充模块声明（官方包未提供这些路径的类型定义）：
 * - `editor.all.js` 注册全部编辑器功能（无语言服务）；
 * - basic-languages 各语言的 Monarch 语法 tokenizer。
 */
declare module "monaco-editor/esm/vs/editor/editor.all.js";

declare module "monaco-editor/esm/vs/basic-languages/*";

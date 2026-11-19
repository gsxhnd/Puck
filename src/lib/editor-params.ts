/**
 * File identity helpers shared by editor surfaces.
 *
 * 编辑器各处共用的文件身份辅助函数：来源类型、文件名截取与 Monaco 语言推断。
 * （独立编辑器窗口已迁移为工作台编辑标签，`window=editor` 参数解析随之移除。）
 */
export type EditorFileSource = "local" | "remote";

export function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1]! : path;
}

export function guessMonacoLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    mdx: "markdown",
    rs: "rust",
    py: "python",
    go: "go",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    cs: "csharp",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    toml: "ini",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    dockerfile: "dockerfile",
    vue: "html",
    svelte: "html",
  };
  return map[ext ?? ""] ?? "plaintext";
}

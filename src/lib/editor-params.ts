export type EditorFileSource = "local" | "remote";

export type EditorParams = {
  path: string;
  source: EditorFileSource;
  sessionId?: string;
};

export function getEditorParams(): EditorParams | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("window") !== "editor") return null;

  const path = params.get("path");
  const source = params.get("source");
  if (!path || (source !== "local" && source !== "remote")) {
    return null;
  }

  return {
    path,
    source,
    sessionId: params.get("sessionId") ?? undefined,
  };
}

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

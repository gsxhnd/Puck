import { useEffect, useRef } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import { ensureMonacoEnvironment } from "@/lib/monaco-setup";

type MonacoEditorPaneProps = {
  value: string;
  language: string;
  theme: "vs" | "vs-dark";
  readOnly?: boolean;
  onChange?: (value: string) => void;
};

export function MonacoEditorPane({
  value,
  language,
  theme,
  readOnly = false,
  onChange,
}: MonacoEditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let disposed = false;
    let editor: MonacoEditor.IStandaloneCodeEditor | null = null;

    void (async () => {
      ensureMonacoEnvironment();
      const monaco = await import("monaco-editor");
      if (disposed || !containerRef.current) return;

      editor = monaco.editor.create(containerRef.current, {
        value,
        language,
        theme,
        readOnly,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        renderWhitespace: "selection",
      });

      editorRef.current = editor;
      editor.onDidChangeModelContent(() => {
        onChangeRef.current?.(editor?.getValue() ?? "");
      });
    })();

    return () => {
      disposed = true;
      editor?.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    void import("monaco-editor").then((monaco) => {
      monaco.editor.setModelLanguage(model, language);
    });
  }, [language]);

  useEffect(() => {
    void import("monaco-editor").then((monaco) => {
      monaco.editor.setTheme(theme);
    });
  }, [theme]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly });
  }, [readOnly]);

  return <div ref={containerRef} className="h-full w-full" />;
}

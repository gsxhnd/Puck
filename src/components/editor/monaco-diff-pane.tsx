/**
 * Monaco diff editor pane for workbench diff tabs.
 *
 * 工作台 Diff 标签的 Monaco 双栏对比视图。只读展示 original/modified 两份
 * 文本，模型在组件卸载时释放。通过 loadMonaco() 获取共享 monaco 实例。
 */
import { useEffect, useRef } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import { loadMonaco } from "@/lib/monaco";
import { ensureMonacoEnvironment } from "@/lib/monaco-setup";

type MonacoDiffPaneProps = {
  original: string;
  modified: string;
  language: string;
};

export function MonacoDiffPane({
  original,
  modified,
  language,
}: MonacoDiffPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diffRef = useRef<MonacoEditor.IDiffEditor | null>(null);
  const modelsRef = useRef<{
    original: MonacoEditor.ITextModel;
    modified: MonacoEditor.ITextModel;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      ensureMonacoEnvironment();
      const monaco = await loadMonaco();
      if (disposed || !containerRef.current) return;

      const originalModel = monaco.editor.createModel(original, language);
      const modifiedModel = monaco.editor.createModel(modified, language);
      const diffEditor = monaco.editor.createDiffEditor(
        containerRef.current,
        {
          readOnly: true,
          automaticLayout: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderOverviewRuler: false,
        },
      );
      diffEditor.setModel({ original: originalModel, modified: modifiedModel });

      diffRef.current = diffEditor;
      modelsRef.current = { original: originalModel, modified: modifiedModel };
    })();

    return () => {
      disposed = true;
      modelsRef.current?.original.dispose();
      modelsRef.current?.modified.dispose();
      diffRef.current?.dispose();
      diffRef.current = null;
      modelsRef.current = null;
    };
    // Content is fixed for the lifetime of a diff tab; the pane is recreated
    // wholesale when the active tab changes, which keeps state handling simple.
    // Diff 标签内容在其生命周期内固定；切换标签时整体重建，保持状态处理简单。
  }, [original, modified, language]);

  return <div ref={containerRef} className="h-full w-full" />;
}

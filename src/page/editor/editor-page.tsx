import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { SaveIcon } from "lucide-react";
import { MonacoEditorPane } from "@/components/editor/monaco-editor-pane";
import { Button } from "@/components/ui/button";
import {
  fileNameFromPath,
  getEditorParams,
  guessMonacoLanguage,
} from "@/lib/editor-params";
import { parsePuckError } from "@/lib/puck-error";
import { isTauri } from "@/lib/platform";
import { readLocalFile, writeLocalFile } from "@/lib/tauri-workspace";
import { readRemoteFile, writeRemoteFile } from "@/lib/tauri-sftp";
import { getEffectiveTheme } from "@/lib/theme-utils";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { toast } from "sonner";

export function EditorPage() {
  const { t } = useTranslation("editor");
  const params = useMemo(() => getEditorParams(), []);
  const themeMode = useAppSettingsStore((state) => state.themeMode);

  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileName = params ? fileNameFromPath(params.path) : "";
  const language = params ? guessMonacoLanguage(params.path) : "plaintext";
  const isDirty = content !== savedContent;
  const monacoTheme =
    getEffectiveTheme(themeMode) === "dark" ? "vs-dark" : "vs";

  const updateWindowTitle = useCallback(
    (dirty: boolean) => {
      if (!params || !isTauri()) return;
      const prefix = dirty ? "• " : "";
      void getCurrentWebviewWindow().setTitle(`${prefix}${fileName}`);
    },
    [fileName, params],
  );

  useEffect(() => {
    updateWindowTitle(isDirty);
  }, [isDirty, updateWindowTitle]);

  useEffect(() => {
    if (!params) {
      setError(t("missingParams"));
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const text =
          params.source === "local"
            ? await readLocalFile(params.path)
            : await readRemoteFile(params.sessionId ?? "", params.path);
        if (cancelled) return;
        setContent(text);
        setSavedContent(text);
      } catch (err) {
        if (cancelled) return;
        setError(parsePuckError(err).message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, t]);

  const save = useCallback(async () => {
    if (!params || saving) return;

    setSaving(true);
    try {
      if (params.source === "local") {
        await writeLocalFile(params.path, content);
      } else {
        await writeRemoteFile(params.sessionId ?? "", params.path, content);
      }
      setSavedContent(content);
      toast.success(t("saved"));
    } catch (err) {
      toast.error(parsePuckError(err).message);
    } finally {
      setSaving(false);
    }
  }, [content, params, saving, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  if (!params) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
        {error ?? t("missingParams")}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">
            {fileName}
            {isDirty ? (
              <span className="ml-1 text-muted-foreground">•</span>
            ) : null}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {params.path}
          </p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          disabled={!isDirty || saving}
          onClick={() => void save()}
        >
          <SaveIcon />
          {t("save")}
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <MonacoEditorPane
          value={content}
          language={language}
          theme={monacoTheme}
          onChange={setContent}
        />
      </div>
    </div>
  );
}

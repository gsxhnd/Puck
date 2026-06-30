import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { WindowTitleBar } from "@/layout/app-shell/window-title-bar";
import { EditorPage } from "@/page/editor/editor-page";
import { fileNameFromPath, getEditorParams } from "@/lib/editor-params";
import { getPlatform } from "@/lib/platform";

export function EditorShell() {
  const { t } = useTranslation("editor");
  const params = useMemo(() => getEditorParams(), []);
  const title = params ? fileNameFromPath(params.path) : t("title");

  return (
    <div
      data-app-shell
      data-shell="editor"
      data-platform={getPlatform()}
      className="flex h-svh flex-col overflow-hidden bg-background"
    >
      <WindowTitleBar title={title} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <EditorPage />
      </div>
    </div>
  );
}

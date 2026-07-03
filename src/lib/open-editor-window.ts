import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import i18n from "@/i18n";
import { buildEditorWindowUrl } from "@/lib/app-window";
import type { EditorFileSource } from "@/lib/editor-params";
import { formatPuckErrorMessage } from "@/lib/puck-error";
import { isTauri } from "@/lib/platform";

export async function openEditorWindow(args: {
  path: string;
  source: EditorFileSource;
  sessionId?: string;
}): Promise<void> {
  if (!isTauri()) {
    const opened = window.open(
      buildEditorWindowUrl(args),
      `editor-${args.path}`,
      "popup,width=900,height=640",
    );
    opened?.focus();
    return;
  }

  try {
    await invoke("open_editor_window", {
      path: args.path,
      source: args.source,
      sessionId: args.sessionId,
    });
  } catch (error) {
    console.error("Failed to open editor window:", error);
    toast.error(formatPuckErrorMessage(i18n.t.bind(i18n), error));
  }
}

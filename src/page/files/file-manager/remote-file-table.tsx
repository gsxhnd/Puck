import { useTranslation } from "react-i18next";
import { FolderIcon } from "lucide-react";
import type { RemoteFileEntry } from "@/lib/tauri-sftp";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatBytes, formatModified } from "@/page/files/file-manager/utils";

/**
 * Scrollable table listing remote directory entries.
 *
 * 远程目录文件列表表格。支持单击选中、双击进入目录，以及通过 ".." 行返回
 * 上级目录；目录行显示文件夹图标，文件行展示大小、修改时间与权限。
 */
export function RemoteFileTable({
  cwd,
  entries,
  loading,
  selectedPath,
  onNavigate,
  onOpenEntry,
}: {
  cwd: string;
  entries: RemoteFileEntry[];
  loading: boolean;
  selectedPath: string | null;
  onNavigate: (path: string) => void;
  onOpenEntry: (entry: RemoteFileEntry) => void;
}) {
  const { t } = useTranslation("files");

  return (
    <ScrollArea className="min-h-0 flex-1">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t("files:columns.name")}</th>
            <th className="px-3 py-2 font-medium">{t("files:columns.size")}</th>
            <th className="px-3 py-2 font-medium">
              {t("files:columns.modified")}
            </th>
            <th className="px-3 py-2 font-medium">
              {t("files:columns.permissions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {cwd !== "/" ? (
            <tr
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => {
                const parent =
                  cwd === "/" ? "/" : cwd.replace(/\/[^/]+$/, "") || "/";
                onNavigate(parent);
              }}
            >
              <td className="px-3 py-2" colSpan={4}>
                ..
              </td>
            </tr>
          ) : null}
          {loading ? (
            <tr>
              <td className="px-3 py-6 text-muted-foreground" colSpan={4}>
                {t("files:loading")}
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr
                key={entry.path}
                className={cn(
                  "file-list-row cursor-pointer hover:bg-muted/40",
                  selectedPath === entry.path && "bg-muted/60",
                )}
                onClick={() => onOpenEntry(entry)}
                onDoubleClick={() => {
                  if (entry.isDir) onOpenEntry(entry);
                }}
              >
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    {entry.isDir ? (
                      <FolderIcon className="size-4 text-sky-500" />
                    ) : null}
                    {entry.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {entry.isDir ? "—" : formatBytes(entry.size)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatModified(entry.modified)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {entry.permissions ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </ScrollArea>
  );
}

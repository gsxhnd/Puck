import { useTranslation } from "react-i18next";
import {
  ChevronRightIcon,
  FolderPlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { breadcrumbPath } from "@/page/files/file-manager/utils";

/**
 * Remote file manager toolbar: breadcrumbs and file operations.
 *
 * 远程文件管理器顶部工具栏：面包屑导航与新建文件夹、上传、下载、重命名、
 * 删除、刷新等操作按钮。所有动作通过回调注入，自身不持有连接状态。
 */
export function FileManagerToolbar({
  breadcrumbs,
  connected,
  selectedPath,
  onNavigate,
  onRefresh,
  onMkdir,
  onUpload,
  onDownload,
  onRename,
  onDelete,
}: {
  breadcrumbs: string[];
  connected: boolean;
  selectedPath: string | null;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onMkdir: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation(["files", "common"]);

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
        {breadcrumbs.map((segment, index) => {
          const path = breadcrumbPath(breadcrumbs, index);
          return (
            <div key={`${segment}-${index}`} className="flex items-center gap-1">
              {index > 0 ? (
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              ) : null}
              <button
                type="button"
                className="rounded px-1 hover:bg-muted"
                onClick={() => onNavigate(path)}
              >
                {segment}
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={!connected}
        >
          <RefreshCwIcon className="size-4" />
          {t("common:actions.refresh")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onMkdir}
          disabled={!connected}
        >
          <FolderPlusIcon className="size-4" />
          {t("files:actions.newFolder")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onUpload}
          disabled={!connected}
        >
          <UploadIcon className="size-4" />
          {t("files:actions.upload")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDownload}
          disabled={!selectedPath}
        >
          {t("files:actions.download")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRename}
          disabled={!selectedPath}
        >
          {t("files:actions.rename")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          disabled={!selectedPath}
        >
          <Trash2Icon className="size-4" />
          {t("common:actions.delete")}
        </Button>
      </div>
    </div>
  );
}

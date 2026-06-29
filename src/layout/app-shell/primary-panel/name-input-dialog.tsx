import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Single-field dialog used to create or rename a sidebar group/session.
 *
 * 一个仅含单个文本输入框的通用对话框，复用于"新建分组"、"重命名分组"
 * 与"重命名会话"三种场景。打开时用 `defaultValue` 重置输入框，提交时会
 * 去除首尾空白并拒绝空名称，确认后回调 `onConfirm` 并关闭对话框。
 */
export function NameInputDialog({
  open,
  title,
  description,
  defaultValue,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  defaultValue?: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void;
}) {
  const { t } = useTranslation("common");
  const [name, setName] = useState(defaultValue ?? "");

  useEffect(() => {
    if (open) {
      setName(defaultValue ?? "");
    }
  }, [defaultValue, open]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Input
              id="sidebar-group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={title}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

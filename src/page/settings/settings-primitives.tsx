import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ComboboxOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * Reusable label + control row for settings sections.
 *
 * 设置项通用行布局：左侧标题与可选描述，右侧放开关/选择器/输入框等控件。
 */
export function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">{title}</div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Typed select wrapper used across settings sections.
 *
 * 设置页专用的类型安全下拉选择器，把选项数组与标签映射封装为 shadcn Select。
 */
export function SettingsSelect<T extends string>({
  value,
  options,
  labels,
  onChange,
  className,
}: {
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  className?: string;
}) {
  const items = Object.fromEntries(
    options.map((option) => [option, labels[option]]),
  ) as Record<T, string>;

  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        if (next !== null) {
          onChange(next as T);
        }
      }}
    >
      <SelectTrigger size="sm" className={cn("w-48", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Searchable combobox wrapper for settings with longer option lists.
 *
 * 设置页可搜索下拉选择器，适合配色方案、语言等选项较多的场景。
 */
export function SettingsCombobox<T extends string>({
  value,
  options,
  labels,
  onChange,
  className,
  placeholder,
}: {
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  className?: string;
  placeholder?: string;
}) {
  const { t } = useTranslation("settings");

  const items = useMemo(
    () =>
      options.map((option) => ({
        value: option,
        label: labels[option],
      })),
    [labels, options],
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.value === value) ?? null,
    [items, value],
  );

  return (
    <Combobox
      items={items}
      value={selectedItem}
      onValueChange={(next) => {
        if (next) {
          onChange(next.value);
        }
      }}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
    >
      <ComboboxInput
        placeholder={placeholder}
        showClear={false}
        className={cn("w-48", className)}
      />
      <ComboboxContent>
        <ComboboxEmpty>{t("settings:combobox.noResults")}</ComboboxEmpty>
        <ComboboxList>
          {(item: ComboboxOption<T>) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

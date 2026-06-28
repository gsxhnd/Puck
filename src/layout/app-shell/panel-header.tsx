import type { ReactNode } from "react";
import { getPlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { useWindowDragRegion } from "@/layout/app-shell/use-window-drag-region";

type PanelHeaderProps = {
  leading?: ReactNode;
  center?: ReactNode;
  trailing?: ReactNode;
  /** Reserves space for macOS traffic lights in the leftmost panel. */
  macosInset?: boolean;
  /** `balanced` centers content between equal side columns; `split` uses space-between. */
  layout?: "balanced" | "split";
  className?: string;
};

export function PanelHeader({
  leading,
  center,
  trailing,
  macosInset = false,
  layout = "split",
  className,
}: PanelHeaderProps) {
  const platform = getPlatform();
  const onMouseDown = useWindowDragRegion();

  const inset =
    macosInset && platform === "macos" ? (
      <div
        className="shrink-0"
        style={{ width: "var(--titlebar-macos-inset)" }}
      />
    ) : null;

  if (layout === "balanced") {
    return (
      <header
        data-platform={platform}
        className={cn(
          "window-title-bar grid h-[var(--titlebar-height)] shrink-0 grid-cols-[1fr_auto_1fr] items-center bg-inherit select-none",
          className,
        )}
        onMouseDown={onMouseDown}
      >
        <div className="flex min-w-0 items-center justify-start gap-1 pl-1">
          {inset}
          {leading}
        </div>
        <div className="flex min-w-0 items-center justify-center px-3">
          {center}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1 pr-1">
          {trailing}
        </div>
      </header>
    );
  }

  return (
    <header
      data-platform={platform}
      className={cn(
        "window-title-bar flex h-[var(--titlebar-height)] shrink-0 items-center gap-2 bg-inherit px-3 select-none",
        className,
      )}
      onMouseDown={onMouseDown}
    >
      {inset}
      {leading ? (
        <div className="flex min-w-0 flex-1 items-center">{leading}</div>
      ) : null}
      {center ? (
        <div className="flex min-w-0 items-center justify-center">{center}</div>
      ) : null}
      {trailing ? (
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {trailing}
        </div>
      ) : null}
    </header>
  );
}

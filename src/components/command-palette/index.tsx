import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderIcon, SearchIcon } from "lucide-react";
import { rehydrateConnections } from "@/lib/rehydrate-connections";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { CommandPaletteItem } from "@/components/command-palette/command-palette-item";
import { usePaletteCommands } from "@/components/command-palette/use-palette-commands";
import type { PaletteCommand } from "@/components/command-palette/types";

/**
 * Global command palette overlay (⌘K).
 *
 * 全局命令面板浮层。支持模糊搜索、键盘上下选择与回车执行；在终端会话激活时
 * 额外提供工作目录相关命令，并可进入「用外部应用打开」子页。命令定义与过滤
 * 逻辑在 `usePaletteCommands` 中，本组件负责交互与渲染。
 */
export function CommandPalette() {
  const { t } = useTranslation(["commandPalette", "terminal", "common"]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const open = useCommandPaletteStore((state) => state.open);
  const page = useCommandPaletteStore((state) => state.page);
  const draftQuery = useCommandPaletteStore((state) => state.draftQuery);
  const closePalette = useCommandPaletteStore((state) => state.closePalette);
  const setPage = useCommandPaletteStore((state) => state.setPage);
  const consumeDraftQuery = useCommandPaletteStore(
    (state) => state.consumeDraftQuery,
  );

  const { sectionOrder, groupedCommands, flatCommands, path } =
    usePaletteCommands(page, query);

  const executeCommand = useCallback(
    async (command: PaletteCommand) => {
      if (command.disabled) {
        return;
      }

      await command.run();
      if (!command.hasSubmenu) {
        closePalette();
      }
    },
    [closePalette],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    void rehydrateConnections();

    if (draftQuery) {
      setQuery(draftQuery);
      consumeDraftQuery();
    }

    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, page, draftQuery, consumeDraftQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, page]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (page === "open-in" || page === "new-terminal") {
          setPage("root");
          setQuery("");
          return;
        }
        closePalette();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, flatCommands.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePalette, flatCommands.length, open, page, setPage]);

  useEffect(() => {
    const node = listRef.current?.querySelector("[data-active='true']");
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) {
    return null;
  }

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 pt-[12vh] backdrop-blur-[2px]">
      <button
        type="button"
        aria-label={t("terminal:titleMenu.closeSearch")}
        className="absolute inset-0"
        onClick={closePalette}
      />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                return;
              }

              if (event.key === "Enter") {
                if (event.nativeEvent.isComposing || isComposingRef.current) {
                  return;
                }
                event.preventDefault();
                const command = flatCommands[activeIndex];
                if (command) {
                  void executeCommand(command);
                }
              }
            }}
            placeholder={
              page === "new-terminal"
                ? t("commandPalette:terminalPickerPlaceholder")
                : t("commandPalette:searchPlaceholder")
            }
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div ref={listRef} className="max-h-[min(60vh,24rem)] overflow-y-auto p-1.5">
          {flatCommands.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("common:empty.noSearchResults")}
            </p>
          ) : (
            sectionOrder.map((section) => {
              const commands = groupedCommands.get(section);
              if (!commands?.length) {
                return null;
              }

              return (
                <section key={section} className="pb-1">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      {t(`commandPalette:sections.${section}`)}
                    </p>
                    {section === "workingDirectory" && path ? (
                      <div className="flex max-w-[55%] items-center gap-1 text-[10px] text-muted-foreground">
                        <FolderIcon className="size-3 shrink-0" />
                        <span className="truncate font-mono">{path}</span>
                      </div>
                    ) : null}
                  </div>
                  {commands.map((command) => {
                    itemIndex += 1;
                    const index = itemIndex;
                    return (
                      <CommandPaletteItem
                        key={command.id}
                        command={command}
                        active={index === activeIndex}
                        onHover={() => setActiveIndex(index)}
                        onSelect={() => void executeCommand(command)}
                      />
                    );
                  })}
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

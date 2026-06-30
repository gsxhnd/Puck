import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderIcon } from "lucide-react";
import { rehydrateConnections } from "@/lib/rehydrate-connections";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { CommandPaletteItem } from "@/components/command-palette/command-palette-item";
import { PaletteScopeChip } from "@/components/command-palette/palette-scope-chip";
import { usePaletteCommands } from "@/components/command-palette/use-palette-commands";
import {
  getPalettePrefix,
  parsePalettePrefix,
  prefixQuery,
  type PaletteCommand,
} from "@/components/command-palette/types";

/**
 * Global command palette overlay (⇧⌘P).
 */
export function CommandPalette() {
  const { t } = useTranslation(["commandPalette", "terminal", "common"]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const open = useCommandPaletteStore((state) => state.open);
  const draftQuery = useCommandPaletteStore((state) => state.draftQuery);
  const closePalette = useCommandPaletteStore((state) => state.closePalette);
  const consumeDraftQuery = useCommandPaletteStore(
    (state) => state.consumeDraftQuery,
  );

  const { activePrefix, sectionOrder, groupedCommands, flatCommands, path } =
    usePaletteCommands(query);

  const parsed = parsePalettePrefix(query);
  const inputValue = activePrefix ? parsed.filter : query;

  const placeholder = activePrefix
    ? t(getPalettePrefix(activePrefix).placeholderKey)
    : t("commandPalette:searchPlaceholder");

  const setInputValue = useCallback(
    (value: string) => {
      if (activePrefix) {
        const alias = getPalettePrefix(activePrefix).aliases[0];
        setQuery(value ? `${alias} ${value}` : `${alias} `);
        return;
      }
      setQuery(value);
    },
    [activePrefix],
  );

  const executeCommand = useCallback(
    async (command: PaletteCommand) => {
      if (command.disabled) {
        return;
      }

      if (command.prefixTarget) {
        setQuery(prefixQuery(command.prefixTarget));
        setActiveIndex(0);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      await command.run();
      closePalette();
    },
    [closePalette],
  );

  const clearScope = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

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
  }, [open, draftQuery, consumeDraftQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (activePrefix) {
          clearScope();
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
  }, [activePrefix, clearScope, closePalette, flatCommands.length, open]);

  useEffect(() => {
    const node = listRef.current?.querySelector("[data-active='true']");
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) {
    return null;
  }

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]">
      <button
        type="button"
        aria-label={t("terminal:titleMenu.closeSearch")}
        className="absolute inset-0"
        onClick={closePalette}
      />
      <div className="relative z-10 flex w-full max-w-[520px] flex-col overflow-hidden rounded-[12px] border border-[#2e2e2e] bg-[#1a1a1a] text-[#e8e8e8] shadow-[0_16px_70px_rgba(0,0,0,0.55)]">
        <div className="px-3 pt-3 pb-2">
          <div className="flex min-h-[36px] items-center gap-2 rounded-[8px] bg-[#222222] px-3 py-1.5">
            {activePrefix ? (
              <PaletteScopeChip prefixId={activePrefix} onClear={clearScope} />
            ) : null}
            <input
              ref={inputRef}
              autoFocus
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
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

                if (
                  event.key === "Backspace" &&
                  activePrefix &&
                  inputValue === ""
                ) {
                  event.preventDefault();
                  clearScope();
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
              placeholder={placeholder}
              className="h-6 min-w-0 flex-1 bg-transparent text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#666666]"
            />
          </div>
        </div>

        <div
          ref={listRef}
          className="max-h-[min(58vh,380px)] overflow-y-auto px-2 pb-2"
        >
          {flatCommands.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-[#666666]">
              {t("common:empty.noSearchResults")}
            </p>
          ) : (
            sectionOrder.map((section) => {
              const commands = groupedCommands.get(section);
              if (!commands?.length) {
                return null;
              }

              return (
                <section key={section} className="pb-0.5">
                  <div className="flex items-center justify-between px-2 pt-2 pb-1">
                    <p className="text-[11px] font-medium text-[#666666]">
                      {t(`commandPalette:sections.${section}`)}
                    </p>
                    {section === "workingDirectory" && path ? (
                      <div className="flex max-w-[55%] items-center gap-1 text-[10px] text-[#666666]">
                        <FolderIcon className="size-3 shrink-0" strokeWidth={1.75} />
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

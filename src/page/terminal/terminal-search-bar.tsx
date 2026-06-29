import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, ChevronUpIcon, SquareDashedIcon, XIcon } from "lucide-react";
import {
  applySelectionToSearch,
  findInAllTerminals,
  findInTerminal,
} from "@/lib/terminal-registry";
import { useSessionStore } from "@/stores/session-store";
import { useTerminalSearchStore } from "@/stores/terminal-search-store";
import { cn } from "@/lib/utils";

function SearchModifierButton({
  label,
  active,
  underlined,
  onClick,
  ariaLabel,
}: {
  label: string;
  active: boolean;
  underlined?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[11px] font-medium transition-colors",
        active
          ? "bg-foreground/15 text-foreground"
          : "text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
        underlined && active && "underline decoration-2 underline-offset-2",
      )}
    >
      {label}
    </button>
  );
}

function SearchIconButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
    >
      {children}
    </button>
  );
}

export function TerminalSearchBar() {
  const { t } = useTranslation("terminal");
  const inputRef = useRef<HTMLInputElement>(null);
  const open = useTerminalSearchStore((state) => state.open);
  const scope = useTerminalSearchStore((state) => state.scope);
  const query = useTerminalSearchStore((state) => state.query);
  const options = useTerminalSearchStore((state) => state.options);
  const setQuery = useTerminalSearchStore((state) => state.setQuery);
  const closeSearch = useTerminalSearchStore((state) => state.closeSearch);
  const toggleOption = useTerminalSearchStore((state) => state.toggleOption);
  const setInSelectionOnly = useTerminalSearchStore(
    (state) => state.setInSelectionOnly,
  );
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

  useEffect(() => {
    if (!open) {
      return;
    }

    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim() || !activeSessionId) {
      return;
    }

    if (scope === "tab") {
      findInTerminal(activeSessionId, query, options, { incremental: true });
      return;
    }

    const matchedSessionId = findInAllTerminals(
      query,
      options,
      activeSessionId ?? undefined,
    );
    if (matchedSessionId) {
      setActiveSession(matchedSessionId);
    }
  }, [activeSessionId, open, options, query, scope, setActiveSession]);

  if (!open) {
    return null;
  }

  const runSearch = (previous = false) => {
    if (!query.trim() || !activeSessionId) {
      return;
    }

    if (scope === "tab") {
      findInTerminal(activeSessionId, query, options, { previous });
      return;
    }

    findInAllTerminals(query, options, activeSessionId ?? undefined);
  };

  const handleSelectionScope = () => {
    if (!activeSessionId) {
      return;
    }

    const next = !options.inSelectionOnly;
    setInSelectionOnly(next);

    if (next) {
      const selection = applySelectionToSearch(activeSessionId);
      if (selection) {
        setQuery(selection);
      }
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="pointer-events-auto absolute top-3 right-3 flex max-w-[min(100%-1.5rem,28rem)] items-center gap-1 rounded-full border border-border/60 bg-popover/95 px-2 py-1 shadow-lg ring-1 ring-foreground/10 backdrop-blur-md">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("titleMenu.searchPlaceholder")}
          className="h-7 min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch(event.shiftKey);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              closeSearch();
            }
          }}
        />

        <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 pl-1">
          <SearchModifierButton
            label="Aa"
            active={options.caseSensitive}
            onClick={() => toggleOption("caseSensitive")}
            ariaLabel={t("titleMenu.searchCaseSensitive")}
          />
          <SearchModifierButton
            label="ab"
            active={options.wholeWord}
            underlined
            onClick={() => toggleOption("wholeWord")}
            ariaLabel={t("titleMenu.searchWholeWord")}
          />
          <SearchModifierButton
            label=".*"
            active={options.regex}
            onClick={() => toggleOption("regex")}
            ariaLabel={t("titleMenu.searchRegex")}
          />
        </div>

        <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 pl-1">
          <SearchIconButton
            ariaLabel={t("titleMenu.searchPrevious")}
            onClick={() => runSearch(true)}
          >
            <ChevronUpIcon className="size-3.5" />
          </SearchIconButton>
          <SearchIconButton
            ariaLabel={t("titleMenu.searchNext")}
            onClick={() => runSearch(false)}
          >
            <ChevronDownIcon className="size-3.5" />
          </SearchIconButton>
          <SearchIconButton
            ariaLabel={t("titleMenu.searchInSelection")}
            onClick={handleSelectionScope}
          >
            <SquareDashedIcon
              className={cn(
                "size-3.5",
                options.inSelectionOnly && "text-primary",
              )}
            />
          </SearchIconButton>
          <SearchIconButton
            ariaLabel={t("titleMenu.closeSearch")}
            onClick={closeSearch}
          >
            <XIcon className="size-3.5" />
          </SearchIconButton>
        </div>
      </div>
    </div>
  );
}

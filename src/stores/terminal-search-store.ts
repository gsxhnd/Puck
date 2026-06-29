import { create } from "zustand";

export type TerminalSearchScope = "tab" | "all";

export type TerminalSearchOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  inSelectionOnly: boolean;
};

type TerminalSearchStore = {
  open: boolean;
  scope: TerminalSearchScope;
  query: string;
  options: TerminalSearchOptions;
  openSearch: (scope?: TerminalSearchScope) => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  toggleOption: (key: keyof TerminalSearchOptions) => void;
  setInSelectionOnly: (value: boolean) => void;
};

const DEFAULT_OPTIONS: TerminalSearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  inSelectionOnly: false,
};

export const useTerminalSearchStore = create<TerminalSearchStore>()((set) => ({
  open: false,
  scope: "tab",
  query: "",
  options: DEFAULT_OPTIONS,
  openSearch: (scope = "tab") =>
    set({ open: true, scope, query: "", options: DEFAULT_OPTIONS }),
  closeSearch: () => set({ open: false, query: "", options: DEFAULT_OPTIONS }),
  setQuery: (query) => set({ query }),
  toggleOption: (key) =>
    set((state) => ({
      options: { ...state.options, [key]: !state.options[key] },
    })),
  setInSelectionOnly: (value) =>
    set((state) => ({
      options: { ...state.options, inSelectionOnly: value },
    })),
}));

import {
  UI_APPEARANCE_CSS_VARS,
  uiAppearanceToCssProperties,
  type UiAppearanceOverrides,
} from "@/lib/ui-appearance-css";

/** Applies user overrides only; theme CSS supplies non-overridden UI chrome. */
export function applyUiAppearanceOverrides(
  overrides: UiAppearanceOverrides = {},
): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  for (const name of UI_APPEARANCE_CSS_VARS) {
    root.style.removeProperty(name);
  }

  const properties = uiAppearanceToCssProperties(overrides);
  for (const [name, value] of Object.entries(properties)) {
    root.style.setProperty(name, value);
  }
}

/** Clears inline UI appearance overrides (e.g. during tests). */
export function clearUiAppearanceOverrides(): void {
  applyUiAppearanceOverrides({});
}

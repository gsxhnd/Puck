import { BUILTIN_COLOR_THEME_ID } from "@/lib/color-themes";

/** Formats a theme file id for the settings picker. */
export function formatColorThemeDisplayName(
  themeId: string,
  language?: string,
): string {
  if (themeId === BUILTIN_COLOR_THEME_ID) {
    return language?.startsWith("zh") ? "默认" : "Default";
  }

  if (language?.startsWith("zh")) {
    return themeId.replace(/-/g, " ");
  }

  return themeId
    .split("-")
    .map((segment) => {
      if (!segment) return segment;
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

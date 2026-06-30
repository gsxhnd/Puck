import { XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getPalettePrefix } from "@/components/command-palette/types";
import type { PalettePrefixId } from "@/components/command-palette/types";

export function PaletteScopeChip({
  prefixId,
  onClear,
}: {
  prefixId: PalettePrefixId;
  onClear: () => void;
}) {
  const { t } = useTranslation("commandPalette");
  const prefix = getPalettePrefix(prefixId);

  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[5px] bg-[#333333] px-1.5 text-[12px] font-medium text-[#e0e0e0]">
      {t(prefix.labelKey)}
      <button
        type="button"
        aria-label={t("clearScope")}
        className="flex size-3.5 items-center justify-center rounded-sm text-[#888888] transition-colors hover:bg-[#444444] hover:text-[#cccccc]"
        onClick={(event) => {
          event.stopPropagation();
          onClear();
        }}
      >
        <XIcon className="size-2.5" strokeWidth={2} />
      </button>
    </span>
  );
}

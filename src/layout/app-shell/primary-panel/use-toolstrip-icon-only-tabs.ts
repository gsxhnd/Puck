import { useEffect, useState, type RefObject } from "react";

/** Hide tab labels below this toolstrip width so three toolbar icons stay visible. */
const ICON_ONLY_TABS_WIDTH = 268;

export function useToolstripIconOnlyTabs(
  ref: RefObject<HTMLElement | null>,
) {
  const [iconOnly, setIconOnly] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = (width: number) => {
      setIconOnly(width < ICON_ONLY_TABS_WIDTH);
    };

    update(node.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      update(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return iconOnly;
}

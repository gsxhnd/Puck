import { useEffect, type RefObject } from "react";

function readPrimaryPanelWidth(shell: HTMLElement, primaryPanelOpen: boolean) {
  const primary = shell.querySelector(
    '[data-panel][id="primary"]',
  ) as HTMLElement | null;

  if (!primaryPanelOpen || !primary || primary.offsetWidth <= 0) {
    return 0;
  }

  return primary.offsetWidth;
}

export function usePrimaryPanelOverlayWidth(
  shellRef: RefObject<HTMLElement | null>,
  primaryPanelOpen: boolean,
) {
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const update = () => {
      const width = readPrimaryPanelWidth(shell, primaryPanelOpen);
      shell.style.setProperty("--primary-panel-width", `${width}px`);
    };

    update();

    const primary = shell.querySelector('[data-panel][id="primary"]');
    if (!primary) return;

    const observer = new ResizeObserver(update);
    observer.observe(primary);
    return () => observer.disconnect();
  }, [primaryPanelOpen, shellRef]);
}

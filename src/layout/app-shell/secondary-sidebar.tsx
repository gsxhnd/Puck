import { SessionInfoSidebar } from "@/layout/app-shell/session-info-sidebar";

type SecondarySidebarProps = {
  rightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
};

export function SecondarySidebar({
  rightSidebarOpen,
  onToggleRightSidebar,
}: SecondarySidebarProps) {
  return (
    <SessionInfoSidebar
      rightSidebarOpen={rightSidebarOpen}
      onToggleRightSidebar={onToggleRightSidebar}
    />
  );
}

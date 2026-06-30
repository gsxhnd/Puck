import type { Session } from "@/types/connection";

export function isSshTerminalSession(
  session: Pick<Session, "kind" | "protocol"> | null,
): boolean {
  return session?.kind === "terminal" && session.protocol === "ssh";
}

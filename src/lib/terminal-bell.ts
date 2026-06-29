import type { IDisposable, Terminal } from "@xterm/xterm";
import type { SessionPrivileges } from "@/types/session-privileges";
import { DEFAULT_SESSION_PRIVILEGES } from "@/types/session-privileges";

function playBellTone() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 800;
    gain.gain.value = 0.08;
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    void context.close();
  } catch {
    // Ignore audio failures in restricted environments.
  }
}

export function shouldPlayTerminalBell(privileges: SessionPrivileges): boolean {
  return privileges.allowTerminalBell && !privileges.soundMute;
}

export function bindTerminalBell(
  terminal: Terminal,
  privileges: Partial<SessionPrivileges> | undefined,
): IDisposable {
  const resolved: SessionPrivileges = {
    ...DEFAULT_SESSION_PRIVILEGES,
    ...privileges,
  };

  return terminal.onBell(() => {
    if (shouldPlayTerminalBell(resolved)) {
      playBellTone();
    }
  });
}

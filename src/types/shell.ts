export type ShellInfo = {
  id: string;
  name: string;
  path: string;
  kind: string;
  args: string[];
};

export type TerminalDataEvent = {
  sessionId: string;
  data: string;
};

export type TerminalExitEvent = {
  sessionId: string;
  code: number | null;
};

export type OpenLocalTerminalResult = {
  sessionId: string;
  shell: ShellInfo;
};

export type SystemIdentity = {
  username: string;
  hostname: string;
};

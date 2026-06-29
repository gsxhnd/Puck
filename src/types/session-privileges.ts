export type SessionPrivilegeKey =
  | "soundMute"
  | "beepOnErrorExit"
  | "allowTerminalBell"
  | "notificationMute"
  | "notifyOnCommandFinish"
  | "notifyOnErrorExit"
  | "notifyOnWatchFinish"
  | "allowAppNotifications"
  | "tabBadgeWhenCommandFinishes"
  | "tabBadgeWhenCommandFails"
  | "keepAwakeWhenTaskRunning"
  | "allowMouseCapture";

export type SessionPrivileges = Record<SessionPrivilegeKey, boolean>;

export const DEFAULT_SESSION_PRIVILEGES: SessionPrivileges = {
  soundMute: false,
  beepOnErrorExit: false,
  allowTerminalBell: true,
  notificationMute: false,
  notifyOnCommandFinish: false,
  notifyOnErrorExit: true,
  notifyOnWatchFinish: true,
  allowAppNotifications: true,
  tabBadgeWhenCommandFinishes: true,
  tabBadgeWhenCommandFails: true,
  keepAwakeWhenTaskRunning: false,
  allowMouseCapture: true,
};

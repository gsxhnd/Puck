import { invoke } from "@tauri-apps/api/core";
import { parseSystemStats } from "@/lib/parse-system-stats";

export type DiskStats = {
  name: string;
  mountPoint: string;
  totalBytes: number;
  availableBytes: number;
};

export type SystemStats = {
  cpuUsage: number;
  memoryUsed: number;
  memoryTotal: number;
  swapUsed: number;
  swapTotal: number;
  primaryDisk: DiskStats | null;
  loadAverage: [number, number, number] | null;
};

export function getSystemStats(): Promise<SystemStats> {
  return invoke<unknown>("get_system_stats").then(parseSystemStats);
}

export function getRemoteSystemStats(sessionId: string): Promise<SystemStats> {
  return invoke<unknown>("get_remote_system_stats", { sessionId }).then(
    parseSystemStats,
  );
}

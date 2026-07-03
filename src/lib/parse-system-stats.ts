import type { DiskStats, SystemStats } from "@/lib/tauri-system";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseDiskStats(value: unknown): DiskStats | null {
  if (!isRecord(value)) return null;

  const name = value.name;
  const mountPoint = value.mountPoint;
  const totalBytes = parseFiniteNumber(value.totalBytes);
  const availableBytes = parseFiniteNumber(value.availableBytes);

  if (
    typeof name !== "string" ||
    typeof mountPoint !== "string" ||
    totalBytes === null ||
    availableBytes === null
  ) {
    return null;
  }

  return { name, mountPoint, totalBytes, availableBytes };
}

function parseLoadAverage(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) return null;

  const one = parseFiniteNumber(value[0]);
  const five = parseFiniteNumber(value[1]);
  const fifteen = parseFiniteNumber(value[2]);

  if (one === null || five === null || fifteen === null) {
    return null;
  }

  return [one, five, fifteen];
}

/** Validates IPC payload shape before the UI consumes system stats. */
export function parseSystemStats(value: unknown): SystemStats {
  if (!isRecord(value)) {
    throw new Error("invalid system stats payload");
  }

  const cpuUsage = parseFiniteNumber(value.cpuUsage);
  const memoryUsed = parseFiniteNumber(value.memoryUsed);
  const memoryTotal = parseFiniteNumber(value.memoryTotal);
  const swapUsed = parseFiniteNumber(value.swapUsed);
  const swapTotal = parseFiniteNumber(value.swapTotal);

  if (
    cpuUsage === null ||
    memoryUsed === null ||
    memoryTotal === null ||
    swapUsed === null ||
    swapTotal === null
  ) {
    throw new Error("invalid system stats payload");
  }

  const primaryDisk =
    value.primaryDisk === null || value.primaryDisk === undefined
      ? null
      : parseDiskStats(value.primaryDisk);

  if (value.primaryDisk != null && primaryDisk === null) {
    throw new Error("invalid system stats disk payload");
  }

  const loadAverage =
    value.loadAverage === null || value.loadAverage === undefined
      ? null
      : parseLoadAverage(value.loadAverage);

  if (value.loadAverage != null && loadAverage === null) {
    throw new Error("invalid system stats load average payload");
  }

  return {
    cpuUsage,
    memoryUsed,
    memoryTotal,
    swapUsed,
    swapTotal,
    primaryDisk,
    loadAverage,
  };
}

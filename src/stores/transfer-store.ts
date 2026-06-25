import { create } from "zustand";
import type {
  TransferDoneEvent,
  TransferErrorEvent,
  TransferProgressEvent,
} from "@/lib/tauri-sftp";

export type TransferStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export type TransferTask = {
  id: string;
  sessionId: string;
  direction: "upload" | "download";
  localPath: string;
  remotePath: string;
  fileName: string;
  bytesTotal?: number;
  bytesTransferred: number;
  status: TransferStatus;
  errorMessage?: string;
};

type TransferStore = {
  tasks: TransferTask[];
  addTask: (task: Omit<TransferTask, "bytesTransferred" | "status">) => TransferTask;
  updateProgress: (event: TransferProgressEvent) => void;
  markDone: (event: TransferDoneEvent) => void;
  markFailed: (event: TransferErrorEvent) => void;
  retryTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
};

export const useTransferStore = create<TransferStore>()((set) => ({
  tasks: [],
  addTask: (task) => {
    const entry: TransferTask = {
      ...task,
      bytesTransferred: 0,
      status: "running",
    };
    set((state) => ({ tasks: [entry, ...state.tasks] }));
    return entry;
  },
  updateProgress: (event) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === event.transferId
          ? {
              ...task,
              bytesTransferred: event.bytesTransferred,
              bytesTotal: event.bytesTotal,
              status: "running",
            }
          : task,
      ),
    }));
  },
  markDone: (event) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === event.transferId
          ? { ...task, status: "done" as const }
          : task,
      ),
    }));
  },
  markFailed: (event) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === event.transferId
          ? {
              ...task,
              status: "failed" as const,
              errorMessage: event.message,
            }
          : task,
      ),
    }));
  },
  retryTask: (id) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              status: "queued" as const,
              bytesTransferred: 0,
              errorMessage: undefined,
            }
          : task,
      ),
    }));
  },
  removeTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }));
  },
  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter(
        (task) => task.status === "running" || task.status === "queued",
      ),
    }));
  },
}));

export function getRetryPayload(task: TransferTask) {
  return {
    sessionId: task.sessionId,
    transferId: task.id,
    direction: task.direction,
    localPath: task.localPath,
    remotePath: task.remotePath,
  };
}

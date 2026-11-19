/**
 * Reference-counted workspace watcher hook.
 *
 * 工作区文件监听的引用计数 hook。多个消费者（Git 面板、文件树等）可同时
 * 监听同一工作区：模块级计数保证 Rust 端 watcher 只在第一个消费者挂载时
 * 启动、最后一个卸载时停止。事件由 Rust 侧做 400ms 防抖，这里直接转发。
 */
import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/platform";

const refCounts = new Map<string, number>();
const unlisteners = new Map<string, () => void>();

/**
 * Subscribes to filesystem changes of a workspace path.
 *
 * 订阅指定工作区的文件系统变更；`path` 为 null 或非 Tauri 环境时不生效。
 * 回调函数通过 ref 保存最新引用，不会导致 effect 重建。
 */
export function useWorkspaceWatch(
  path: string | null,
  onChange: () => void,
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!path || !isTauri()) return;

    const count = (refCounts.get(path) ?? 0) + 1;
    refCounts.set(path, count);

    if (count === 1) {
      void invoke("start_workspace_watch", { path }).catch(() => {
        // Watching is best-effort; failures fall back to manual refresh.
        // 监听属于尽力而为的能力，失败时回退到手动刷新。
      });
      void listen("workspace:changed", () => {
        // The backend normalizes paths (canonicalize), so filtering by the
        // raw path string here would be unreliable; with a single active
        // workspace any event is relevant.
        // 后端会规范化路径（canonicalize），用原始字符串过滤不可靠；
        // 当前只有一个活动工作区，任何事件都与它相关。
        onChangeRef.current();
      }).then((unlisten) => {
        unlisteners.set(path, unlisten);
      });
    }

    return () => {
      const current = (refCounts.get(path) ?? 1) - 1;
      if (current <= 0) {
        refCounts.delete(path);
        void invoke("stop_workspace_watch", { path }).catch(() => {
          // Ignore stop failures. 忽略停止失败。
        });
        unlisteners.get(path)?.();
        unlisteners.delete(path);
      } else {
        refCounts.set(path, current);
      }
    };
  }, [path]);
}

//! Workspace file watcher backed by the `notify` crate.
//!
//! 工作区文件监听（基于 `notify`）。为指定工作区目录建立递归监听，事件经过
//! 400ms 防抖合并后以 `workspace:changed` 事件推送给前端；忽略构建产物与依赖
//! 目录（node_modules/target/dist 等）避免事件风暴。Git 元数据（.git）不忽略，
//! 以便文件保存、暂存等操作后自动刷新 Git 面板。watcher 按工作区路径全局
//! 去重：前端引用计数归零时调用 stop 释放。

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{PuckError, PuckResult};
use crate::sync_mutex::lock_or_recover;
use crate::workspace::resolve_path;

/// Event emitted when a watched workspace changes.
///
/// 被监听工作区发生变化时推送的事件，payload 带规范化后的工作区路径。
pub const WORKSPACE_CHANGED_EVENT: &str = "workspace:changed";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceChangedEvent {
    pub path: String,
}

/// How long to wait for quiet after the last event before emitting.
/// 事件静默多久后合并推送一次。
const DEBOUNCE: Duration = Duration::from_millis(400);

struct WatchRegistry {
    watchers: Mutex<HashMap<PathBuf, notify::RecommendedWatcher>>,
}

fn registry() -> &'static WatchRegistry {
    static REGISTRY: std::sync::OnceLock<WatchRegistry> = std::sync::OnceLock::new();
    REGISTRY.get_or_init(|| WatchRegistry {
        watchers: Mutex::new(HashMap::new()),
    })
}

/// Directories whose events are irrelevant (build output / dependencies).
///
/// 与编辑器无关的目录（构建产物与依赖），其事件直接丢弃。
fn is_ignored(path: &Path) -> bool {
    path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        matches!(
            name.as_ref(),
            "node_modules" | "target" | "dist" | ".next" | ".turbo" | ".cache"
        )
    }) || path
        .file_name()
        .is_some_and(|name| name == ".DS_Store")
}

fn canonicalize(path: &str) -> PuckResult<PathBuf> {
    let resolved = resolve_path(path)?;
    if !resolved.is_dir() {
        return Err(PuckError::config("Path is not a directory"));
    }
    Ok(resolved.canonicalize().unwrap_or(resolved))
}

/// Starts watching a workspace directory (idempotent per canonical path).
///
/// 开始监听工作区目录；同一规范化路径重复调用为空操作。事件经防抖后以
/// `workspace:changed` 广播，前端按工作区路径自行过滤。
#[tauri::command]
pub fn start_workspace_watch(app: AppHandle, path: String) -> Result<(), String> {
    let canonical = canonicalize(&path).map_err(|error| error.to_string())?;

    {
        let watchers = lock_or_recover(&registry().watchers);
        if watchers.contains_key(&canonical) {
            return Ok(());
        }
    }

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<PathBuf>();
    let mut watcher =
        notify::recommended_watcher(move |result: Result<notify::Event, notify::Error>| {
            if let Ok(event) = result {
                // Access events (reads) carry no useful change signal.
                // 纯访问（读取）事件不携带变更信息，忽略。
                if matches!(event.kind, notify::EventKind::Access(_)) {
                    return;
                }
                for changed in event.paths {
                    let _ = tx.send(changed);
                }
            }
        })
        .map_err(|error| error.to_string())?;

    watcher
        .watch(&canonical, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;

    lock_or_recover(&registry().watchers).insert(canonical.clone(), watcher);

    let emit_path = canonical.to_string_lossy().into_owned();
    tauri::async_runtime::spawn(async move {
        while let Some(first) = rx.recv().await {
            if !is_ignored(&first) {
                // Drain until a quiet period so bursts (e.g. `git checkout`)
                // collapse into a single notification.
                // 持续排空直到静默，避免 git checkout 等批量操作造成事件风暴。
                while let Ok(Some(_)) = tokio::time::timeout(DEBOUNCE, rx.recv()).await {
                    // Extra events within the window are folded into this one.
                    // 窗口内的后续事件合并进同一次通知。
                }
                let _ = app.emit(
                    WORKSPACE_CHANGED_EVENT,
                    WorkspaceChangedEvent {
                        path: emit_path.clone(),
                    },
                );
            }
        }
    });

    Ok(())
}

/// Stops watching a workspace directory; dropping the watcher stops the OS
/// watches and closes the debounce channel.
///
/// 停止监听工作区目录；drop watcher 即停止系统监听并关闭防抖通道。
#[tauri::command]
pub fn stop_workspace_watch(path: String) -> Result<(), String> {
    let canonical = canonicalize(&path).map_err(|error| error.to_string())?;
    lock_or_recover(&registry().watchers).remove(&canonical);
    Ok(())
}

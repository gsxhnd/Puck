//! Saved connection profiles persisted in `connections.json`.
//!
//! 已保存连接配置的独立存储。数据保存在 `~/.config/puck/connections.json`，
//! 与 `config.toml` 分离；文件内容为前端 Zustand persist 序列化后的 JSON 字符串。

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, State};

use crate::config::config_dir;

const CONNECTIONS_FILE_NAME: &str = "connections.json";

/// Path to `~/.config/puck/connections.json`.
pub fn connections_file_path() -> PathBuf {
    config_dir().join(CONNECTIONS_FILE_NAME)
}

fn load_connections_file(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }
    fs::read_to_string(path).ok()
}

fn save_connections_file(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, content).map_err(|error| error.to_string())
}

/// Thread-safe cache of the connections file with write-through saves.
pub struct ConnectionsStore {
    path: PathBuf,
    content: Mutex<Option<String>>,
}

impl ConnectionsStore {
    pub fn new() -> Self {
        let path = connections_file_path();
        let content = load_connections_file(&path);
        Self {
            path,
            content: Mutex::new(content),
        }
    }

    pub fn load(&self) -> Option<String> {
        self.content.lock().unwrap().clone()
    }

    pub fn save(&self, value: &str) -> Result<(), String> {
        save_connections_file(&self.path, value)?;
        *self.content.lock().unwrap() = Some(value.to_string());
        Ok(())
    }

    pub fn remove(&self) -> Result<(), String> {
        if self.path.exists() {
            fs::remove_file(&self.path).map_err(|error| error.to_string())?;
        }
        *self.content.lock().unwrap() = None;
        Ok(())
    }
}

#[tauri::command]
pub fn get_connections_file_path() -> String {
    connections_file_path().to_string_lossy().into_owned()
}

#[tauri::command]
pub fn load_connections(store: State<'_, Arc<ConnectionsStore>>) -> Option<String> {
    store.load()
}

#[tauri::command]
pub fn save_connections(
    app: AppHandle,
    store: State<'_, Arc<ConnectionsStore>>,
    value: String,
) -> Result<(), String> {
    store.save(&value)?;
    let _ = app.emit("puck:connections-changed", ());
    Ok(())
}

#[tauri::command]
pub fn remove_connections(
    app: AppHandle,
    store: State<'_, Arc<ConnectionsStore>>,
) -> Result<(), String> {
    store.remove()?;
    let _ = app.emit("puck:connections-changed", ());
    Ok(())
}

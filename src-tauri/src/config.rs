//! Unified on-disk configuration store backed by `config.toml`.
//!
//! 应用的统一配置中心。UI 状态（应用设置、侧栏布局、会话权限、Shell 布局）
//! 保存在 `~/.config/puck/config.toml`；连接配置与 SSH known hosts 分别使用
//! `connections.json` 与 `known_hosts.json`（见对应模块）。

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

const CONFIG_FILE_NAME: &str = "config.toml";
const CONFIG_VERSION: u32 = 1;

pub const SECTION_APP_SETTINGS: &str = "app_settings";
pub const SECTION_SIDEBAR_LAYOUT: &str = "sidebar_layout";
pub const SECTION_SESSION_PRIVILEGES: &str = "session_privileges";
pub const SECTION_SHELL_LAYOUT: &str = "shell_layout";

const UI_SECTIONS: [&str; 4] = [
    SECTION_APP_SETTINGS,
    SECTION_SIDEBAR_LAYOUT,
    SECTION_SESSION_PRIVILEGES,
    SECTION_SHELL_LAYOUT,
];

/// A trusted SSH host key entry.
///
/// 一条已信任的 SSH 主机公钥记录。host + port 唯一标识一个远端端点，
/// 同时保留 OpenSSH 文本格式公钥与其指纹用于后续校验。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownHostRecord {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub public_key: String,
    pub fingerprint: String,
}

/// Typed representation of the whole `config.toml` file.
///
/// `config.toml` 文件的强类型映射。各 UI 区段以不透明的 `serde_json::Value`
/// 存储，从而无需在 Rust 侧重复定义前端的状态结构；缺省字段在序列化时被
/// 跳过，使配置文件保持精简。
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PuckConfigFile {
    #[serde(default = "default_config_version")]
    pub version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_settings: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sidebar_layout: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_privileges: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shell_layout: Option<Value>,
}

fn default_config_version() -> u32 {
    CONFIG_VERSION
}

/// Returns `~/.config/puck` on Linux, macOS, and Windows.
pub fn config_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".config").join("puck");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn config_file_path() -> PathBuf {
    config_dir().join(CONFIG_FILE_NAME)
}

/// Thread-safe, in-memory cache of the config file with write-through saves.
///
/// 配置文件的线程安全内存缓存。整个配置在内存中由 `Mutex` 保护，任何写操作
/// 都会立即回写磁盘（write-through）；作为 Tauri 的全局 state 在多个命令与
/// 窗口间共享。
pub struct PuckConfigStore {
    path: PathBuf,
    config: Mutex<PuckConfigFile>,
}

impl PuckConfigStore {
    pub fn new() -> Self {
        let path = config_file_path();
        let config = load_config(&path);
        Self {
            path,
            config: Mutex::new(config),
        }
    }

    pub fn get_section(&self, section: &str) -> Option<String> {
        let config = self.config.lock().unwrap();
        section_value(&config, section).and_then(|value| serde_json::to_string(value).ok())
    }

    pub fn set_section(&self, section: &str, json: &str) -> Result<(), String> {
        let value: Value = serde_json::from_str(json).map_err(|error| error.to_string())?;
        let mut config = self.config.lock().unwrap();
        set_section_value(&mut config, section, Some(value));
        save_config(&self.path, &config)
    }

    pub fn remove_section(&self, section: &str) -> Result<(), String> {
        let mut config = self.config.lock().unwrap();
        set_section_value(&mut config, section, None);
        save_config(&self.path, &config)
    }

    pub fn load_ui_sections(&self) -> HashMap<String, String> {
        let config = self.config.lock().unwrap();
        let mut sections = HashMap::new();
        for section in UI_SECTIONS {
            if let Some(value) = section_value(&config, section) {
                if let Ok(serialized) = serde_json::to_string(value) {
                    sections.insert(section.to_string(), serialized);
                }
            }
        }
        sections
    }
}

fn section_value<'a>(config: &'a PuckConfigFile, section: &str) -> Option<&'a Value> {
    match section {
        SECTION_APP_SETTINGS => config.app_settings.as_ref(),
        SECTION_SIDEBAR_LAYOUT => config.sidebar_layout.as_ref(),
        SECTION_SESSION_PRIVILEGES => config.session_privileges.as_ref(),
        SECTION_SHELL_LAYOUT => config.shell_layout.as_ref(),
        _ => None,
    }
}

fn set_section_value(config: &mut PuckConfigFile, section: &str, value: Option<Value>) {
    match section {
        SECTION_APP_SETTINGS => config.app_settings = value,
        SECTION_SIDEBAR_LAYOUT => config.sidebar_layout = value,
        SECTION_SESSION_PRIVILEGES => config.session_privileges = value,
        SECTION_SHELL_LAYOUT => config.shell_layout = value,
        _ => {}
    }
}

fn load_config(path: &Path) -> PuckConfigFile {
    if path.exists() {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(config) = toml::from_str::<PuckConfigFile>(&content) {
                return config;
            }
        }
    }
    PuckConfigFile::default()
}

fn save_config(path: &Path, config: &PuckConfigFile) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = toml::to_string_pretty(config).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_config_dir() -> String {
    config_dir().to_string_lossy().into_owned()
}

#[tauri::command]
pub fn get_config_file_path() -> String {
    config_file_path().to_string_lossy().into_owned()
}

#[tauri::command]
pub fn load_puck_config_sections(
    store: State<'_, Arc<PuckConfigStore>>,
) -> HashMap<String, String> {
    store.load_ui_sections()
}

#[tauri::command]
pub fn get_puck_config_section(
    store: State<'_, Arc<PuckConfigStore>>,
    section: String,
) -> Option<String> {
    store.get_section(&section)
}

#[tauri::command]
pub fn set_puck_config_section(
    app: AppHandle,
    store: State<'_, Arc<PuckConfigStore>>,
    section: String,
    value: String,
) -> Result<(), String> {
    store.set_section(&section, &value)?;
    let _ = app.emit("puck:config-changed", section);
    Ok(())
}

#[tauri::command]
pub fn remove_puck_config_section(
    app: AppHandle,
    store: State<'_, Arc<PuckConfigStore>>,
    section: String,
) -> Result<(), String> {
    store.remove_section(&section)?;
    let _ = app.emit("puck:config-changed", section);
    Ok(())
}

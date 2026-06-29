use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use crate::error::PuckResult;

const CONFIG_FILE_NAME: &str = "config.toml";
const CONFIG_VERSION: u32 = 1;

pub const SECTION_APP_SETTINGS: &str = "app_settings";
pub const SECTION_CONNECTIONS: &str = "connections";
pub const SECTION_SIDEBAR_LAYOUT: &str = "sidebar_layout";
pub const SECTION_SESSION_PRIVILEGES: &str = "session_privileges";
pub const SECTION_SHELL_LAYOUT: &str = "shell_layout";

const UI_SECTIONS: [&str; 5] = [
    SECTION_APP_SETTINGS,
    SECTION_CONNECTIONS,
    SECTION_SIDEBAR_LAYOUT,
    SECTION_SESSION_PRIVILEGES,
    SECTION_SHELL_LAYOUT,
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownHostRecord {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub public_key: String,
    pub fingerprint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PuckConfigFile {
    #[serde(default = "default_config_version")]
    pub version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_settings: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connections: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sidebar_layout: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_privileges: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shell_layout: Option<Value>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub known_hosts: Vec<KnownHostRecord>,
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

    pub fn known_hosts(&self) -> Vec<KnownHostRecord> {
        self.config.lock().unwrap().known_hosts.clone()
    }

    pub fn update_known_hosts<F>(&self, update: F) -> PuckResult<()>
    where
        F: FnOnce(&mut Vec<KnownHostRecord>),
    {
        let mut config = self.config.lock().unwrap();
        update(&mut config.known_hosts);
        save_config(&self.path, &config).map_err(Into::into)
    }
}

fn section_value<'a>(config: &'a PuckConfigFile, section: &str) -> Option<&'a Value> {
    match section {
        SECTION_APP_SETTINGS => config.app_settings.as_ref(),
        SECTION_CONNECTIONS => config.connections.as_ref(),
        SECTION_SIDEBAR_LAYOUT => config.sidebar_layout.as_ref(),
        SECTION_SESSION_PRIVILEGES => config.session_privileges.as_ref(),
        SECTION_SHELL_LAYOUT => config.shell_layout.as_ref(),
        _ => None,
    }
}

fn set_section_value(config: &mut PuckConfigFile, section: &str, value: Option<Value>) {
    match section {
        SECTION_APP_SETTINGS => config.app_settings = value,
        SECTION_CONNECTIONS => config.connections = value,
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

    let (config, migrated) = migrate_legacy_json_files();
    if migrated {
        let _ = save_config(path, &config);
        cleanup_legacy_json_files();
    }
    config
}

fn save_config(path: &Path, config: &PuckConfigFile) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = toml::to_string_pretty(config).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn migrate_legacy_json_files() -> (PuckConfigFile, bool) {
    let dir = config_dir();
    let mut config = PuckConfigFile::default();
    let mut migrated = false;

    let legacy_sections = [
        ("puck-app-settings.json", SECTION_APP_SETTINGS),
        ("puck-connections.json", SECTION_CONNECTIONS),
        ("puck-sidebar-layout.json", SECTION_SIDEBAR_LAYOUT),
        ("puck-session-privileges.json", SECTION_SESSION_PRIVILEGES),
        ("puck-shell-layout.json", SECTION_SHELL_LAYOUT),
    ];

    for (file_name, section) in legacy_sections {
        let path = dir.join(file_name);
        if let Some(value) = read_legacy_json_value(&path) {
            set_section_value(&mut config, section, Some(value));
            migrated = true;
        }
    }

    let known_hosts_path = dir.join("known_hosts.json");
    if known_hosts_path.exists() {
        if let Ok(content) = fs::read_to_string(&known_hosts_path) {
            let records: Vec<KnownHostRecord> = serde_json::from_str(&content).unwrap_or_default();
            if !records.is_empty() {
                config.known_hosts = records;
                migrated = true;
            }
        }
    }

    (config, migrated)
}

fn read_legacy_json_value(path: &Path) -> Option<Value> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn cleanup_legacy_json_files() {
    let dir = config_dir();
    let legacy_files = [
        "puck-app-settings.json",
        "puck-connections.json",
        "puck-sidebar-layout.json",
        "puck-session-privileges.json",
        "puck-shell-layout.json",
        "known_hosts.json",
    ];

    for file_name in legacy_files {
        let path = dir.join(file_name);
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }
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

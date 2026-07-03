//! SSH known-hosts management persisted in `known_hosts.json`.
//!
//! 基于独立文件 `~/.config/puck/known_hosts.json` 的 SSH known hosts 管理。
//! 负责判断远端主机公钥是否已被信任、信任并保存新公钥、删除已信任记录，
//! 以及在首次连接遇到未知主机时生成供前端确认的提示信息。

use crate::atomic_file::{atomic_write, backup_corrupt_file};
use crate::sync_mutex::lock_or_recover;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use russh::keys::{HashAlg, PublicKey};

use crate::config::{config_dir, KnownHostRecord};
use crate::error::{host_key_prompt, HostKeyPrompt, PuckResult};

const KNOWN_HOSTS_FILE_NAME: &str = "known_hosts.json";

/// Path to `~/.config/puck/known_hosts.json`.
pub fn known_hosts_file_path() -> PathBuf {
    config_dir().join(KNOWN_HOSTS_FILE_NAME)
}

fn load_known_hosts_file(path: &Path) -> Vec<KnownHostRecord> {
    if !path.exists() {
        return Vec::new();
    }

    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) => {
            eprintln!(
                "puck: failed to read known hosts file {}: {error}",
                path.display()
            );
            return Vec::new();
        }
    };

    match serde_json::from_str::<Vec<KnownHostRecord>>(&content) {
        Ok(records) => records,
        Err(error) => {
            let backup_path = backup_corrupt_file(path);
            let backup_note = backup_path
                .as_ref()
                .map(|backup| backup.display().to_string())
                .unwrap_or_else(|| "backup failed".to_string());
            eprintln!(
                "puck: known hosts file {} is invalid ({error}); reset to empty list. Backup: {backup_note}",
                path.display()
            );
            Vec::new()
        }
    }
}

fn save_known_hosts_file(path: &Path, records: &[KnownHostRecord]) -> PuckResult<()> {
    let content =
        serde_json::to_string_pretty(records).map_err(|error| error.to_string())?;
    atomic_write(path, &content).map_err(|error| error.to_string())?;
    Ok(())
}

fn merge_known_host(records: &mut Vec<KnownHostRecord>, record: KnownHostRecord) {
    if let Some(existing) = records
        .iter_mut()
        .find(|item| item.host == record.host && item.port == record.port)
    {
        *existing = record;
    } else {
        records.push(record);
    }
}

/// Manages trusted host keys in a dedicated JSON file.
///
/// known hosts 的领域逻辑封装；数据持久化在 `known_hosts.json`，与 `config.toml`
/// 分离。
pub struct KnownHostsStore {
    path: PathBuf,
    records: Mutex<Vec<KnownHostRecord>>,
}

impl KnownHostsStore {
    pub fn new() -> Self {
        let path = known_hosts_file_path();
        let records = load_known_hosts_file(&path);

        Self {
            path,
            records: Mutex::new(records),
        }
    }

    pub fn list(&self) -> Vec<KnownHostRecord> {
        lock_or_recover(&self.records).clone()
    }

    /// Returns whether the given host/port already trusts this public key.
    pub fn is_trusted(&self, host: &str, port: u16, public_key: &PublicKey) -> bool {
        let key_text = public_key_to_openssh(public_key);
        let fingerprint = fingerprint_for_key(public_key);
        lock_or_recover(&self.records).iter().any(|record| {
            record.host == host
                && record.port == port
                && (record.public_key == key_text || record.fingerprint == fingerprint)
        })
    }

    /// Trusts a host key, replacing any existing record for the same endpoint.
    pub fn trust_key(
        &self,
        host: String,
        port: u16,
        public_key: &PublicKey,
    ) -> PuckResult<KnownHostRecord> {
        let record = KnownHostRecord {
            host: host.clone(),
            port,
            key_type: format!("{:?}", public_key.algorithm()),
            public_key: public_key_to_openssh(public_key),
            fingerprint: fingerprint_for_key(public_key),
        };

        let mut records = lock_or_recover(&self.records);
        merge_known_host(&mut records, record.clone());
        save_known_hosts_file(&self.path, &records)?;
        Ok(record)
    }

    pub fn remove(&self, host: &str, port: u16) -> PuckResult<bool> {
        let mut records = lock_or_recover(&self.records);
        let before = records.len();
        records.retain(|record| !(record.host == host && record.port == port));
        let removed = records.len() != before;
        if removed {
            save_known_hosts_file(&self.path, &records)?;
        }
        Ok(removed)
    }

    pub fn prompt_for_key(host: &str, port: u16, public_key: &PublicKey) -> HostKeyPrompt {
        host_key_prompt(host, port, public_key)
    }
}

/// Serializes a public key to its single-line OpenSSH text form.
pub fn public_key_to_openssh(public_key: &PublicKey) -> String {
    public_key.to_openssh().unwrap_or_default()
}

/// Computes the SHA-256 fingerprint string shown to users.
pub fn fingerprint_for_key(public_key: &PublicKey) -> String {
    public_key.fingerprint(HashAlg::Sha256).to_string()
}

#[tauri::command]
pub fn get_known_hosts_file_path() -> String {
    known_hosts_file_path().to_string_lossy().into_owned()
}

#[tauri::command]
pub fn list_known_hosts(
    state: tauri::State<'_, Arc<KnownHostsStore>>,
) -> Vec<KnownHostRecord> {
    state.list()
}

#[tauri::command]
pub fn delete_known_host(
    state: tauri::State<'_, Arc<KnownHostsStore>>,
    host: String,
    port: u16,
) -> Result<bool, String> {
    state
        .remove(&host, port)
        .map_err(|error| {
            let payload = error.to_payload();
            serde_json::to_string(&payload).unwrap_or(payload.message)
        })
}

#[tauri::command]
pub fn trust_ssh_host_key(
    state: tauri::State<'_, Arc<KnownHostsStore>>,
    host: String,
    port: u16,
    public_key: String,
) -> Result<KnownHostRecord, String> {
    let parsed = PublicKey::from_openssh(&public_key).map_err(|error| error.to_string())?;
    state
        .trust_key(host, port, &parsed)
        .map_err(|error| {
            let payload = error.to_payload();
            serde_json::to_string(&payload).unwrap_or(payload.message)
        })
}

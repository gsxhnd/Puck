use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use russh::keys::{HashAlg, PublicKey};

use crate::error::{host_key_prompt, HostKeyPrompt, PuckError, PuckResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownHostRecord {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub public_key: String,
    pub fingerprint: String,
}

pub struct KnownHostsStore {
    path: PathBuf,
    records: Mutex<Vec<KnownHostRecord>>,
}

impl KnownHostsStore {
    pub fn new() -> Self {
        let path = app_data_path("known_hosts.json");
        let records = load_records(&path);
        Self {
            path,
            records: Mutex::new(records),
        }
    }

    pub fn list(&self) -> Vec<KnownHostRecord> {
        self.records.lock().unwrap().clone()
    }

    pub fn is_trusted(&self, host: &str, port: u16, public_key: &PublicKey) -> bool {
        let key_text = public_key_to_openssh(public_key);
        let fingerprint = fingerprint_for_key(public_key);
        self.records.lock().unwrap().iter().any(|record| {
            record.host == host
                && record.port == port
                && (record.public_key == key_text || record.fingerprint == fingerprint)
        })
    }

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

        let mut records = self.records.lock().unwrap();
        if let Some(existing) = records.iter_mut().find(|item| item.host == host && item.port == port)
        {
            *existing = record.clone();
        } else {
            records.push(record.clone());
        }
        save_records(&self.path, &records)?;
        Ok(record)
    }

    pub fn remove(&self, host: &str, port: u16) -> PuckResult<bool> {
        let mut records = self.records.lock().unwrap();
        let before = records.len();
        records.retain(|record| !(record.host == host && record.port == port));
        if records.len() == before {
            return Ok(false);
        }
        save_records(&self.path, &records)?;
        Ok(true)
    }

    pub fn prompt_for_key(host: &str, port: u16, public_key: &PublicKey) -> HostKeyPrompt {
        host_key_prompt(host, port, public_key)
    }
}

fn app_data_path(file_name: &str) -> PathBuf {
    let base = dirs::data_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("puck");
    let _ = fs::create_dir_all(&dir);
    dir.join(file_name)
}

fn load_records(path: &PathBuf) -> Vec<KnownHostRecord> {
    let Ok(content) = fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_records(path: &PathBuf, records: &[KnownHostRecord]) -> PuckResult<()> {
    let content = serde_json::to_string_pretty(records)
        .map_err(|error| PuckError::Message(error.to_string()))?;
    fs::write(path, content).map_err(PuckError::from)?;
    Ok(())
}

pub fn public_key_to_openssh(public_key: &PublicKey) -> String {
    public_key.to_openssh().unwrap_or_default()
}

pub fn fingerprint_for_key(public_key: &PublicKey) -> String {
    public_key.fingerprint(HashAlg::Sha256).to_string()
}

#[tauri::command]
pub fn list_known_hosts(state: tauri::State<'_, std::sync::Arc<KnownHostsStore>>) -> Vec<KnownHostRecord> {
    state.list()
}

#[tauri::command]
pub fn delete_known_host(
    state: tauri::State<'_, std::sync::Arc<KnownHostsStore>>,
    host: String,
    port: u16,
) -> Result<bool, String> {
    state
        .remove(&host, port)
        .map_err(|error| serde_json::to_string(&error.to_payload()).unwrap())
}

#[tauri::command]
pub fn trust_ssh_host_key(
    state: tauri::State<'_, std::sync::Arc<KnownHostsStore>>,
    host: String,
    port: u16,
    public_key: String,
) -> Result<KnownHostRecord, String> {
    let parsed = PublicKey::from_openssh(&public_key).map_err(|error| error.to_string())?;
    state
        .trust_key(host, port, &parsed)
        .map_err(|error| serde_json::to_string(&error.to_payload()).unwrap())
}

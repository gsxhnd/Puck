use std::sync::Arc;

use russh::keys::{HashAlg, PublicKey};

use crate::config::{KnownHostRecord, PuckConfigStore};
use crate::error::{host_key_prompt, HostKeyPrompt, PuckResult};

pub struct KnownHostsStore {
    config: Arc<PuckConfigStore>,
}

impl KnownHostsStore {
    pub fn new(config: Arc<PuckConfigStore>) -> Self {
        Self { config }
    }

    pub fn list(&self) -> Vec<KnownHostRecord> {
        self.config.known_hosts()
    }

    pub fn is_trusted(&self, host: &str, port: u16, public_key: &PublicKey) -> bool {
        let key_text = public_key_to_openssh(public_key);
        let fingerprint = fingerprint_for_key(public_key);
        self.config.known_hosts().iter().any(|record| {
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

        self.config.update_known_hosts(|records| {
            if let Some(existing) = records
                .iter_mut()
                .find(|item| item.host == host && item.port == port)
            {
                *existing = record.clone();
            } else {
                records.push(record.clone());
            }
        })?;

        Ok(record)
    }

    pub fn remove(&self, host: &str, port: u16) -> PuckResult<bool> {
        let mut removed = false;
        self.config.update_known_hosts(|records| {
            let before = records.len();
            records.retain(|record| !(record.host == host && record.port == port));
            removed = records.len() != before;
        })?;
        Ok(removed)
    }

    pub fn prompt_for_key(host: &str, port: u16, public_key: &PublicKey) -> HostKeyPrompt {
        host_key_prompt(host, port, public_key)
    }
}

pub fn public_key_to_openssh(public_key: &PublicKey) -> String {
    public_key.to_openssh().unwrap_or_default()
}

pub fn fingerprint_for_key(public_key: &PublicKey) -> String {
    public_key.fingerprint(HashAlg::Sha256).to_string()
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
        .map_err(|error| serde_json::to_string(&error.to_payload()).unwrap())
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
        .map_err(|error| serde_json::to_string(&error.to_payload()).unwrap())
}

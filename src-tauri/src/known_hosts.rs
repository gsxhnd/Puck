//! SSH known-hosts management on top of the shared config store.
//!
//! 基于统一配置存储的 SSH known hosts 管理。负责判断某个远端主机公钥是否
//! 已被信任、信任并保存新的主机公钥、删除已信任记录，以及在首次连接遇到
//! 未知主机时生成供前端确认的提示信息。所有数据最终都落在 `config.toml`
//! 的 `known_hosts` 字段中。

use std::sync::Arc;

use russh::keys::{HashAlg, PublicKey};

use crate::config::{KnownHostRecord, PuckConfigStore};
use crate::error::{host_key_prompt, HostKeyPrompt, PuckResult};

/// Manages trusted host keys, delegating persistence to `PuckConfigStore`.
///
/// known hosts 的领域逻辑封装；自身不直接读写磁盘，而是把持久化委托给
/// 共享的 `PuckConfigStore`，因此可与其它配置共用同一份文件与锁。
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

    /// Returns whether the given host/port already trusts this public key.
    ///
    /// 判断指定 host/port 是否已信任该公钥；公钥文本或指纹任一匹配即视为可信，
    /// 以兼容不同来源记录的细微差异。
    pub fn is_trusted(&self, host: &str, port: u16, public_key: &PublicKey) -> bool {
        let key_text = public_key_to_openssh(public_key);
        let fingerprint = fingerprint_for_key(public_key);
        self.config.known_hosts().iter().any(|record| {
            record.host == host
                && record.port == port
                && (record.public_key == key_text || record.fingerprint == fingerprint)
        })
    }

    /// Trusts a host key, replacing any existing record for the same endpoint.
    ///
    /// 信任并保存一个主机公钥：若该 host/port 已有记录则原地更新，否则追加，
    /// 保证同一端点只保留一条最新记录。返回最终写入的记录。
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

/// Serializes a public key to its single-line OpenSSH text form.
///
/// 将公钥序列化为 OpenSSH 单行文本格式；序列化失败时返回空串以避免 panic。
pub fn public_key_to_openssh(public_key: &PublicKey) -> String {
    public_key.to_openssh().unwrap_or_default()
}

/// Computes the SHA-256 fingerprint string shown to users.
///
/// 计算用于向用户展示的 SHA-256 公钥指纹字符串。
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

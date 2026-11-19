//! Remote desktop (RDP/VNC) session skeleton.
//!
//! 远程桌面（RDP/VNC）会话骨架。管理会话注册表与状态事件链路；图形协议后端
//! （IronRDP / VNC，阶段 6/7）尚未接入，连接请求会立即以
//! `desktop_backend_unimplemented` 失败事件结束。前端标签状态机、占位 UI 与
//! 关闭入口已按最终形态就绪——接入真实协议时只需替换内部连接实现，并复用
//! `session:status` 事件与同一注册表。

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::error::{PuckError, PuckResult};
use crate::session::{emit_session_status, SessionStatusEvent};
use crate::sync_mutex::lock_or_recover;

/// Supported graphical remote protocols.
///
/// 支持的图形远程协议。
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RemoteDesktopProtocol {
    Rdp,
    Vnc,
}

impl RemoteDesktopProtocol {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "rdp" => Some(Self::Rdp),
            "vnc" => Some(Self::Vnc),
            _ => None,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Rdp => "rdp",
            Self::Vnc => "vnc",
        }
    }
}

/// Registry of in-flight remote desktop sessions.
///
/// 进行中的远程桌面会话注册表，key 为前端生成的 sessionId。
pub struct RemoteDesktopRegistry {
    sessions: Mutex<HashMap<String, RemoteDesktopProtocol>>,
}

impl RemoteDesktopRegistry {
    fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn global() -> &'static Self {
        static REGISTRY: OnceLock<RemoteDesktopRegistry> = OnceLock::new();
        REGISTRY.get_or_init(RemoteDesktopRegistry::new)
    }

    fn insert(&self, session_id: String, protocol: RemoteDesktopProtocol) {
        lock_or_recover(&self.sessions).insert(session_id, protocol);
    }

    fn remove(&self, session_id: &str) -> Option<RemoteDesktopProtocol> {
        lock_or_recover(&self.sessions).remove(session_id)
    }
}

fn to_invoke_error(error: PuckError) -> String {
    let payload = error.to_payload();
    serde_json::to_string(&payload).unwrap_or(payload.message)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDesktopInfo {
    pub session_id: String,
    pub protocol: &'static str,
    pub host: String,
    pub port: u16,
}

/// Starts a remote desktop session.
///
/// 启动远程桌面会话：校验协议与主机，登记会话并推送 `creating` 状态；图形
/// 后端未接入时推送 `failed`（错误码 `desktop_backend_unimplemented`）并
/// 清理会话。失败通过事件传递而非命令错误，与 SSH host-key 流程一致。
#[tauri::command]
pub async fn start_remote_desktop(
    app: AppHandle,
    session_id: String,
    protocol: String,
    host: String,
    port: u16,
    #[allow(unused_variables)] username: Option<String>,
    // Accepted but deliberately unused until the real handshake lands; never
    // logged or persisted.
    // 预留参数：真实握手接入前不使用，且绝不写入日志或持久化存储。
    #[allow(unused_variables)] password: Option<String>,
) -> Result<(), String> {
    let parsed = RemoteDesktopProtocol::parse(&protocol)
        .ok_or_else(|| to_invoke_error(PuckError::config("Unknown remote desktop protocol")))?;
    if host.trim().is_empty() {
        return Err(to_invoke_error(PuckError::config("Host is required")));
    }

    RemoteDesktopRegistry::global().insert(session_id.clone(), parsed);

    emit_session_status(
        &app,
        SessionStatusEvent {
            session_id: session_id.clone(),
            status: "creating".into(),
            error_code: None,
            message: None,
            host_key: None,
        },
    );

    tracing::info!(
        session_id = %session_id,
        protocol = parsed.as_str(),
        host = %host,
        port,
        "remote desktop session requested (backend pending)"
    );

    // TODO(phase-6): perform the real RDP handshake via IronRDP (TLS/NLA
    // authentication, server certificate trust prompt, graphics pipeline and
    // input channel). VNC follows in phase 7.
    // 阶段 6 接入 IronRDP 真实握手（TLS/NLA 认证、服务端证书信任提示、图形
    // 管线与输入通道）；VNC 在阶段 7 接入。
    RemoteDesktopRegistry::global().remove(&session_id);
    emit_session_status(
        &app,
        SessionStatusEvent {
            session_id,
            status: "failed".into(),
            error_code: Some("desktop_backend_unimplemented".into()),
            message: Some(format!(
                "{} graphics backend is not implemented yet",
                parsed.as_str()
            )),
            host_key: None,
        },
    );

    Ok(())
}

/// Stops a remote desktop session explicitly.
///
/// 显式停止远程桌面会话；会话不存在时静默成功。
#[tauri::command]
pub fn stop_remote_desktop(session_id: String) -> Result<(), String> {
    RemoteDesktopRegistry::global().remove(&session_id);
    Ok(())
}

/// Returns the current in-flight session list (diagnostics).
///
/// 返回当前进行中的会话列表（诊断用途）。
#[tauri::command]
pub fn list_remote_desktop_sessions() -> Vec<RemoteDesktopInfo> {
    lock_or_recover(&RemoteDesktopRegistry::global().sessions)
        .iter()
        .map(|(session_id, protocol)| RemoteDesktopInfo {
            session_id: session_id.clone(),
            protocol: protocol.as_str(),
            host: String::new(),
            port: 0,
        })
        .collect()
}

/// One trusted RDP server certificate entry.
///
/// 一条已信任的 RDP 服务端证书记录。host + port 定位端点，fingerprint 为
/// 证书 DER 的 SHA-256 十六进制摘要；与 SSH known hosts 分开存储。
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustedRdpHost {
    pub host: String,
    pub port: u16,
    pub fingerprint: String,
}

/// Path of the RDP trust store inside the Puck config directory.
///
/// RDP 信任存储文件路径（位于 Puck 配置目录），与 SSH known_hosts 分离。
fn trust_file_path() -> PathBuf {
    crate::config::config_dir().join("rdp_trusted_hosts.json")
}

fn load_trusted_hosts() -> Vec<TrustedRdpHost> {
    let path = trust_file_path();
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str(&content).unwrap_or_else(|error| {
        tracing::warn!(?error, "failed to parse rdp_trusted_hosts.json; ignoring");
        Vec::new()
    })
}

fn save_trusted_hosts(list: &[TrustedRdpHost]) -> PuckResult<()> {
    let path = trust_file_path();
    let content = serde_json::to_string_pretty(list)
        .map_err(|error| PuckError::config(format!("serialize trust store: {error}")))?;
    crate::atomic_file::atomic_write(&path, &content).map_err(PuckError::from)?;
    Ok(())
}

/// True when the fingerprint matches the stored one for this endpoint.
///
/// 指纹与该端点已存储记录一致时返回 true。
fn is_host_trusted(host: &str, port: u16, fingerprint: &str) -> bool {
    load_trusted_hosts().iter().any(|entry| {
        entry.host == host && entry.port == port && entry.fingerprint == fingerprint
    })
}

/// Persists a trusted host certificate (deduplicated).
///
/// 持久化一条受信任的主机证书（去重；同端点同指纹只保留一条）。
fn trust_host_inner(host: &str, port: u16, fingerprint: &str) -> PuckResult<()> {
    if host.trim().is_empty() || fingerprint.trim().is_empty() {
        return Err(PuckError::config("Host and fingerprint are required"));
    }

    let mut list = load_trusted_hosts();
    if !list.iter().any(|entry| {
        entry.host == host && entry.port == port && entry.fingerprint == fingerprint
    }) {
        list.push(TrustedRdpHost {
            host: host.to_string(),
            port,
            fingerprint: fingerprint.to_string(),
        });
        save_trusted_hosts(&list)?;
    }
    Ok(())
}

#[tauri::command]
pub fn trust_rdp_host(host: String, port: u16, fingerprint: String) -> Result<(), String> {
    trust_host_inner(&host, port, &fingerprint).map_err(to_invoke_error)
}

#[tauri::command]
pub fn is_rdp_host_trusted(
    host: String,
    port: u16,
    fingerprint: String,
) -> Result<bool, String> {
    Ok(is_host_trusted(&host, port, &fingerprint))
}

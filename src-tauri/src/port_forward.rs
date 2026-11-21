//! SSH local port forwarding (`ssh -L`) with supervised TCP relays.
//!
//! SSH 本地端口转发。默认仅允许 loopback 监听；每个本地 TCP 连接建立独立
//! direct-tcpip channel，停止时同时回收 listener 与所有活动 relay。

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::{JoinHandle, JoinSet};

use crate::error::PuckError;
use crate::ssh::{lease_shared_ssh, release_shared_ssh, SshClientHandler};
use crate::sync_mutex::lock_or_recover;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartLocalForwardRequest {
    pub forward_id: String,
    pub connection_id: String,
    pub local_host: Option<String>,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortForwardInfo {
    pub forward_id: String,
    pub connection_id: String,
    pub local_address: String,
    pub remote_host: String,
    pub remote_port: u16,
    pub status: String,
    pub error: Option<String>,
}

struct ForwardEntry {
    connection_id: String,
    local_address: String,
    remote_host: String,
    remote_port: u16,
    stop_tx: tokio::sync::watch::Sender<bool>,
    task: JoinHandle<()>,
}

static FORWARDS: OnceLock<Mutex<HashMap<String, ForwardEntry>>> = OnceLock::new();

fn forwards() -> &'static Mutex<HashMap<String, ForwardEntry>> {
    FORWARDS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn to_invoke_error(error: PuckError) -> String {
    let payload = error.into_payload();
    serde_json::to_string(&payload).unwrap_or(payload.message)
}

fn info(entry: &ForwardEntry, forward_id: &str, status: &str, error: Option<String>) -> PortForwardInfo {
    PortForwardInfo {
        forward_id: forward_id.to_string(),
        connection_id: entry.connection_id.clone(),
        local_address: entry.local_address.clone(),
        remote_host: entry.remote_host.clone(),
        remote_port: entry.remote_port,
        status: status.to_string(),
        error,
    }
}

fn emit_status(app: &AppHandle, payload: PortForwardInfo) {
    if let Err(error) = app.emit("forward:status", payload) {
        tracing::warn!(?error, "failed to emit forward:status");
    }
}

async fn relay(
    stream: TcpStream,
    peer: std::net::SocketAddr,
    handle: Arc<russh::client::Handle<SshClientHandler>>,
    remote_host: String,
    remote_port: u16,
) {
    let result = async {
        let channel = handle
            .channel_open_direct_tcpip(
                remote_host,
                u32::from(remote_port),
                peer.ip().to_string(),
                u32::from(peer.port()),
            )
            .await?;
        let mut ssh_stream = channel.into_stream();
        let mut local_stream = stream;
        tokio::io::copy_bidirectional(&mut local_stream, &mut ssh_stream).await?;
        Ok::<(), russh::Error>(())
    }
    .await;
    if let Err(error) = result {
        tracing::debug!(?error, %peer, "port forward relay ended");
    }
}

struct ForwardSupervisor {
    app: AppHandle,
    forward_id: String,
    connection_id: String,
    remote_host: String,
    remote_port: u16,
    listener: TcpListener,
    handle: Arc<russh::client::Handle<SshClientHandler>>,
    stop_rx: tokio::sync::watch::Receiver<bool>,
}

async fn supervise(mut supervisor: ForwardSupervisor) {
    let mut relays = JoinSet::new();
    let mut failure = None;
    loop {
        tokio::select! {
            _ = supervisor.stop_rx.changed() => break,
            _ = tokio::time::sleep(Duration::from_secs(1)) => {
                if supervisor.handle.is_closed() {
                    failure = Some("SSH connection closed".to_string());
                    break;
                }
            }
            accepted = supervisor.listener.accept() => {
                match accepted {
                    Ok((stream, peer)) => {
                        relays.spawn(relay(
                            stream,
                            peer,
                            supervisor.handle.clone(),
                            supervisor.remote_host.clone(),
                            supervisor.remote_port,
                        ));
                    }
                    Err(error) => {
                        failure = Some(format!("Failed to accept local connection: {error}"));
                        break;
                    }
                }
            }
            _ = relays.join_next(), if !relays.is_empty() => {}
        }
    }

    relays.shutdown().await;
    release_shared_ssh(&supervisor.connection_id, &supervisor.forward_id).await;
    lock_or_recover(forwards()).remove(&supervisor.forward_id);

    let local_address = supervisor
        .listener
        .local_addr()
        .map(|address| address.to_string())
        .unwrap_or_default();
    emit_status(
        &supervisor.app,
        PortForwardInfo {
            forward_id: supervisor.forward_id,
            connection_id: supervisor.connection_id,
            local_address,
            remote_host: supervisor.remote_host,
            remote_port: supervisor.remote_port,
            status: if failure.is_some() { "failed".into() } else { "stopped".into() },
            error: failure,
        },
    );
}

#[tauri::command]
pub async fn start_local_port_forward(
    app: AppHandle,
    request: StartLocalForwardRequest,
) -> Result<PortForwardInfo, String> {
    let result = async {
        if request.forward_id.trim().is_empty() || request.remote_host.trim().is_empty() {
            return Err(PuckError::config("Forward id and remote host are required"));
        }
        if request.remote_port == 0 {
            return Err(PuckError::config("Remote port must be between 1 and 65535"));
        }
        if lock_or_recover(forwards()).contains_key(&request.forward_id) {
            return Err(PuckError::config("Port forward already exists"));
        }

        let local_host = request.local_host.as_deref().unwrap_or("127.0.0.1");
        let ip = local_host
            .parse::<IpAddr>()
            .map_err(|_| PuckError::config("Local host must be a loopback IP address"))?;
        if !ip.is_loopback() {
            return Err(PuckError::config(
                "Non-loopback forwarding is disabled; bind 127.0.0.1 or ::1",
            ));
        }

        let handle = lease_shared_ssh(&request.connection_id, &request.forward_id)?;
        let listener = match TcpListener::bind((ip, request.local_port)).await {
            Ok(listener) => listener,
            Err(error) => {
                release_shared_ssh(&request.connection_id, &request.forward_id).await;
                return Err(PuckError::network(format!(
                    "Failed to bind {ip}:{}: {error}",
                    request.local_port
                )));
            }
        };
        let local_address = listener.local_addr().map_err(PuckError::from)?.to_string();
        let (stop_tx, stop_rx) = tokio::sync::watch::channel(false);
        let task = tokio::spawn(supervise(ForwardSupervisor {
            app: app.clone(),
            forward_id: request.forward_id.clone(),
            connection_id: request.connection_id.clone(),
            remote_host: request.remote_host.clone(),
            remote_port: request.remote_port,
            listener,
            handle,
            stop_rx,
        }));
        let entry = ForwardEntry {
            connection_id: request.connection_id,
            local_address,
            remote_host: request.remote_host,
            remote_port: request.remote_port,
            stop_tx,
            task,
        };
        let payload = info(&entry, &request.forward_id, "running", None);
        lock_or_recover(forwards()).insert(request.forward_id, entry);
        emit_status(&app, payload.clone());
        Ok(payload)
    }
    .await;
    result.map_err(to_invoke_error)
}

async fn stop_forward(forward_id: &str) {
    let entry = lock_or_recover(forwards()).remove(forward_id);
    if let Some(entry) = entry {
        let _ = entry.stop_tx.send(true);
        let _ = entry.task.await;
    }
}

#[tauri::command]
pub async fn stop_local_port_forward(forward_id: String) -> Result<(), String> {
    stop_forward(&forward_id).await;
    Ok(())
}

pub async fn stop_forwards_for_connection(connection_id: &str) {
    let ids = {
        let entries = lock_or_recover(forwards());
        entries
            .iter()
            .filter(|(_, entry)| entry.connection_id == connection_id)
            .map(|(id, _)| id.clone())
            .collect::<Vec<_>>()
    };
    for id in ids {
        stop_forward(&id).await;
    }
}

#[tauri::command]
pub fn list_local_port_forwards(connection_id: Option<String>) -> Vec<PortForwardInfo> {
    let entries = lock_or_recover(forwards());
    let mut result = entries
        .iter()
        .filter(|(_, entry)| {
            connection_id
                .as_deref()
                .map(|id| id == entry.connection_id)
                .unwrap_or(true)
        })
        .map(|(id, entry)| info(entry, id, "running", None))
        .collect::<Vec<_>>();
    result.sort_by(|left, right| left.local_address.cmp(&right.local_address));
    result
}

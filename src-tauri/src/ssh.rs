use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use bytes::Bytes;
use russh::client;
use russh::keys::{decode_secret_key, PrivateKey, PrivateKeyWithHashAlg, PublicKey};
use russh::ChannelMsg;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use crate::credential::read_credential;
use crate::error::{host_key_prompt, HostKeyPrompt, PuckError, PuckResult};
use crate::known_hosts::KnownHostsStore;
use crate::runtime::runtime;
use crate::session::{
    emit_connection_error, emit_session_status, SessionKind, SessionManager,
    SessionStatusEvent, SshCommand, StoredSshProfile, TerminalBackend,
};
use crate::sync_mutex::lock_or_recover;
use crate::terminal::{TerminalDataEvent, TerminalExitEvent};
use crate::utf8_stream::Utf8StreamDecoder;

fn emit_terminal_chunk(
    app: &AppHandle,
    session_id: &str,
    decoder: &mut Utf8StreamDecoder,
    chunk: &[u8],
) {
    let payload = decoder.push(chunk);
    if payload.is_empty() {
        return;
    }
    if let Err(error) = app.emit(
        "terminal:data",
        TerminalDataEvent {
            session_id: session_id.to_string(),
            data: payload,
        },
    ) {
        tracing::warn!(?error, session_id, "failed to emit terminal:data");
    }
}

fn flush_terminal_decoder(app: &AppHandle, session_id: &str, decoder: &mut Utf8StreamDecoder) {
    let tail = decoder.finish();
    if tail.is_empty() {
        return;
    }
    if let Err(error) = app.emit(
        "terminal:data",
        TerminalDataEvent {
            session_id: session_id.to_string(),
            data: tail,
        },
    ) {
        tracing::warn!(?error, session_id, "failed to emit terminal:data flush");
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConnectRequest {
    pub session_id: String,
    pub connection_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub private_key_path: Option<String>,
    pub password: Option<String>,
    pub passphrase: Option<String>,
    pub cwd: Option<String>,
    pub cols: u16,
    pub rows: u16,
}

const SSH_CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
const SSH_AUTH_TIMEOUT: Duration = Duration::from_secs(30);
const SSH_KEEPALIVE_INTERVAL: Duration = Duration::from_secs(15);
const SSH_KEEPALIVE_MAX: usize = 3;
const REMOTE_EXEC_TIMEOUT: Duration = Duration::from_secs(30);

fn ssh_client_config() -> Arc<client::Config> {
    Arc::new(client::Config {
        keepalive_interval: Some(SSH_KEEPALIVE_INTERVAL),
        keepalive_max: SSH_KEEPALIVE_MAX,
        ..client::Config::default()
    })
}

pub(crate) struct SshClientHandler {
    host: String,
    port: u16,
    known_hosts: Arc<KnownHostsStore>,
    pending: Arc<Mutex<Option<HostKeyPrompt>>>,
}

impl client::Handler for SshClientHandler {
    type Error = PuckError;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        if self
            .known_hosts
            .is_trusted(&self.host, self.port, server_public_key)
        {
            return Ok(true);
        }
        *lock_or_recover(&self.pending) = Some(host_key_prompt(
            &self.host,
            self.port,
            server_public_key,
        ));
        Ok(false)
    }
}

pub async fn connect_authenticated(
    known_hosts: Arc<KnownHostsStore>,
    request: &SshConnectRequest,
) -> PuckResult<client::Handle<SshClientHandler>> {
    let pending = Arc::new(Mutex::new(None));
    let handler = SshClientHandler {
        host: request.host.clone(),
        port: request.port,
        known_hosts,
        pending: pending.clone(),
    };

    let config = ssh_client_config();
    let mut session = match tokio::time::timeout(
        SSH_CONNECT_TIMEOUT,
        client::connect(config, (request.host.as_str(), request.port), handler),
    )
    .await
    {
        Ok(Ok(session)) => session,
        Ok(Err(error)) => {
            if let Some(prompt) = lock_or_recover(&pending).take() {
                return Err(PuckError::HostKeyUnknown(prompt));
            }
            return Err(error);
        }
        Err(_) => return Err(PuckError::network("connection timed out")),
    };

    match tokio::time::timeout(SSH_AUTH_TIMEOUT, authenticate(&mut session, request)).await {
        Ok(Ok(())) => Ok(session),
        Ok(Err(error)) => Err(error),
        Err(_) => Err(PuckError::network("authentication timed out")),
    }
}

struct SharedSshEntry {
    handle: Arc<client::Handle<SshClientHandler>>,
    owners: HashSet<String>,
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    private_key_path: Option<String>,
}

impl SharedSshEntry {
    fn endpoint_matches(&self, request: &SshConnectRequest) -> bool {
        self.host == request.host
            && self.port == request.port
            && self.username == request.username
            && self.auth_method == request.auth_method
            && self.private_key_path == request.private_key_path
    }
}

static SHARED_SSH_CONNECTIONS: OnceLock<Mutex<HashMap<String, SharedSshEntry>>> = OnceLock::new();
static SHARED_SSH_CONNECT_LOCKS: OnceLock<
    Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
> = OnceLock::new();
static SSH_OPEN_GENERATIONS: OnceLock<Mutex<HashMap<String, u64>>> = OnceLock::new();

fn ssh_open_generations() -> &'static Mutex<HashMap<String, u64>> {
    SSH_OPEN_GENERATIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn begin_ssh_open(session_id: &str) -> u64 {
    let mut generations = lock_or_recover(ssh_open_generations());
    let generation = generations
        .get(session_id)
        .map(|value| value.saturating_add(1))
        .unwrap_or(1);
    generations.insert(session_id.to_string(), generation);
    generation
}

pub fn cancel_ssh_open(session_id: &str) {
    let _ = begin_ssh_open(session_id);
}

pub(crate) fn ssh_open_is_current(session_id: &str, generation: u64) -> bool {
    lock_or_recover(ssh_open_generations())
        .get(session_id)
        .copied()
        .unwrap_or(0)
        == generation
}

fn shared_ssh_connections() -> &'static Mutex<HashMap<String, SharedSshEntry>> {
    SHARED_SSH_CONNECTIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn shared_ssh_connect_locks(
) -> &'static Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>> {
    SHARED_SSH_CONNECT_LOCKS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Acquires one lease on a shared authenticated SSH connection.
///
/// 按 connectionId 获取共享 SSH 连接的一个租约。同一 owner 重复获取是幂等操作；
/// 首个使用者建立连接，后续终端、SFTP、Git 与 Tunnel 复用同一 Handle。
pub async fn acquire_shared_ssh(
    known_hosts: Arc<KnownHostsStore>,
    request: &SshConnectRequest,
    owner_id: &str,
) -> PuckResult<Arc<client::Handle<SshClientHandler>>> {
    let connect_lock = {
        let mut locks = lock_or_recover(shared_ssh_connect_locks());
        locks
            .entry(request.connection_id.clone())
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
            .clone()
    };
    let _guard = connect_lock.lock().await;

    let stale_handle = {
        let mut connections = lock_or_recover(shared_ssh_connections());
        if let Some(entry) = connections.get_mut(&request.connection_id)
            && !entry.handle.is_closed()
            && entry.endpoint_matches(request)
        {
            entry.owners.insert(owner_id.to_string());
            return Ok(entry.handle.clone());
        }
        // A closed transport or an edited profile must not be reused. Old
        // channels are disconnected explicitly; their async tasks observe closure.
        // 已关闭或 profile 已变更的连接不可复用；显式断开旧 transport。
        connections
            .remove(&request.connection_id)
            .map(|entry| entry.handle)
    };
    if let Some(handle) = stale_handle {
        let _ = handle
            .disconnect(russh::Disconnect::ByApplication, "", "en")
            .await;
    }

    let handle = Arc::new(connect_authenticated(known_hosts, request).await?);
    let mut connections = lock_or_recover(shared_ssh_connections());
    connections.insert(
        request.connection_id.clone(),
        SharedSshEntry {
            handle: handle.clone(),
            owners: HashSet::from([owner_id.to_string()]),
            host: request.host.clone(),
            port: request.port,
            username: request.username.clone(),
            auth_method: request.auth_method.clone(),
            private_key_path: request.private_key_path.clone(),
        },
    );
    Ok(handle)
}

/// Releases a lease and disconnects only after the final owner has left.
///
/// 释放一个连接租约；仅当最后一个使用者离开后才真正断开 SSH。
pub async fn release_shared_ssh(connection_id: &str, owner_id: &str) {
    let handle = {
        let mut connections = lock_or_recover(shared_ssh_connections());
        let should_remove = connections
            .get(connection_id)
            .map(|entry| entry.owners.len() == 1 && entry.owners.contains(owner_id))
            .unwrap_or(false);
        if should_remove {
            connections.remove(connection_id).map(|entry| entry.handle)
        } else {
            if let Some(entry) = connections.get_mut(connection_id) {
                entry.owners.remove(owner_id);
            }
            None
        }
    };

    if let Some(handle) = handle {
        let _ = handle
            .disconnect(russh::Disconnect::ByApplication, "", "en")
            .await;
    }
}

/// Drops a broken connection so the next acquire performs a fresh handshake.
///
/// 丢弃已断开的连接，使下一次获取重新握手；各 owner 的释放操作仍然幂等。
pub async fn invalidate_shared_ssh(connection_id: &str) {
    let entry = lock_or_recover(shared_ssh_connections()).remove(connection_id);
    if let Some(entry) = entry {
        let _ = entry
            .handle
            .disconnect(russh::Disconnect::ByApplication, "", "en")
            .await;
    }
}

/// Adds a consumer lease to an already established connection.
///
/// 为已建立的连接增加一个消费者租约，供无需再次解析凭据的 Tunnel 使用。
pub fn lease_shared_ssh(
    connection_id: &str,
    owner_id: &str,
) -> PuckResult<Arc<client::Handle<SshClientHandler>>> {
    let mut connections = lock_or_recover(shared_ssh_connections());
    let entry = connections
        .get_mut(connection_id)
        .ok_or_else(|| PuckError::network("shared ssh connection not found"))?;
    if entry.handle.is_closed() {
        return Err(PuckError::network("ssh connection is closed"));
    }
    entry.owners.insert(owner_id.to_string());
    Ok(entry.handle.clone())
}

pub fn shared_ssh_handle(
    connection_id: &str,
) -> Option<Arc<client::Handle<SshClientHandler>>> {
    lock_or_recover(shared_ssh_connections())
        .get(connection_id)
        .map(|entry| entry.handle.clone())
}

fn to_invoke_error(error: PuckError) -> String {
    let payload = error.into_payload();
    serde_json::to_string(&payload).unwrap_or(payload.message)
}

/// Ensures a long-lived workspace lease before using Git or port forwarding.
///
/// 在远程 Git 或端口转发前确保 Workspace 租约已建立，并复用 session:status
/// 事件呈现连接状态和 Host Key 确认。
#[tauri::command]
pub async fn ensure_ssh_connection(
    app: AppHandle,
    known_hosts: State<'_, Arc<KnownHostsStore>>,
    request: SshConnectRequest,
    owner_id: String,
) -> Result<(), String> {
    emit_session_status(
        &app,
        SessionStatusEvent {
            session_id: request.session_id.clone(),
            status: "creating".into(),
            error_code: None,
            message: None,
            host_key: None,
        },
    );
    match acquire_shared_ssh(known_hosts.inner().clone(), &request, &owner_id).await {
        Ok(_) => {
            emit_session_status(
                &app,
                SessionStatusEvent {
                    session_id: request.session_id,
                    status: "connected".into(),
                    error_code: None,
                    message: None,
                    host_key: None,
                },
            );
            Ok(())
        }
        Err(error) => {
            emit_connection_error(&app, request.session_id, error.clone());
            Err(to_invoke_error(error))
        }
    }
}

#[tauri::command]
pub async fn release_ssh_connection(
    connection_id: String,
    owner_id: String,
) -> Result<(), String> {
    if owner_id.starts_with("workspace:") {
        crate::port_forward::stop_forwards_for_connection(&connection_id).await;
    }
    release_shared_ssh(&connection_id, &owner_id).await;
    Ok(())
}

async fn resolve_password(request: &SshConnectRequest) -> PuckResult<String> {
    if let Some(password) = request.password.clone() {
        return Ok(password);
    }

    let connection_id = request.connection_id.clone();
    tokio::task::spawn_blocking(move || {
        read_credential(&connection_id, "password")?.ok_or_else(|| {
            PuckError::config("missing credential: password")
        })
    })
    .await
    .map_err(|error| PuckError::Message(error.to_string()))?
}

async fn load_private_key(request: &SshConnectRequest) -> PuckResult<PrivateKey> {
    let path = request
        .private_key_path
        .clone()
        .ok_or_else(|| PuckError::config("private key path is required"))?;
    let connection_id = request.connection_id.clone();
    let passphrase = request.passphrase.clone();

    tokio::task::spawn_blocking(move || {
        let content = std::fs::read_to_string(&path).map_err(PuckError::from)?;
        let passphrase = match passphrase {
            Some(value) => Some(value),
            None => read_credential(&connection_id, "passphrase")?,
        };
        decode_secret_key(&content, passphrase.as_deref())
            .map_err(|error| PuckError::auth_failed(error.to_string()))
    })
    .await
    .map_err(|error| PuckError::Message(error.to_string()))?
}

async fn authenticate(
    session: &mut client::Handle<SshClientHandler>,
    request: &SshConnectRequest,
) -> PuckResult<()> {
    let username = request.username.as_str();

    let auth_result = match request.auth_method.as_str() {
        "password" => {
            let password = resolve_password(request).await?;
            session
                .authenticate_password(username, password)
                .await
                .map_err(PuckError::from)?
        }
        "privateKey" => {
            let key = load_private_key(request).await?;
            session
                .authenticate_publickey(
                    username,
                    PrivateKeyWithHashAlg::new(Arc::new(key), None),
                )
                .await
                .map_err(PuckError::from)?
        }
        _ => return Err(PuckError::config("unsupported auth method")),
    };

    if !auth_result.success() {
        return Err(PuckError::auth_failed("authentication rejected"));
    }

    Ok(())
}

/// Executes on a workspace-owned shared connection and preserves raw stdout.
///
/// 在 Workspace 持有的共享连接上执行命令并保留原始 stdout，供 Git 的 NUL
/// 分隔协议使用；stderr 仅用于构造非零退出状态错误。
pub async fn exec_remote_command_on_connection(
    connection_id: &str,
    command: &str,
) -> Result<String, String> {
    let handle = shared_ssh_handle(connection_id)
        .ok_or_else(|| "shared ssh connection not found".to_string())?;
    match tokio::time::timeout(
        REMOTE_EXEC_TIMEOUT,
        exec_remote_command_with_handle(handle, command),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => Err("remote command timed out".into()),
    }
}

async fn exec_remote_command_with_handle(
    handle: Arc<client::Handle<SshClientHandler>>,
    command: &str,
) -> Result<String, String> {
    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|error| error.to_string())?;
    channel
        .exec(true, command)
        .await
        .map_err(|error| error.to_string())?;

    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let mut exit_status = None;

    while let Some(message) = channel.wait().await {
        match message {
            ChannelMsg::Data { data } => stdout.extend_from_slice(&data),
            ChannelMsg::ExtendedData { data, ext: 1, .. } => {
                stderr.extend_from_slice(&data)
            }
            ChannelMsg::ExitStatus { exit_status: code } => exit_status = Some(code),
            ChannelMsg::Eof => break,
            _ => {}
        }
    }

    if exit_status.unwrap_or(1) != 0 {
        let error = String::from_utf8_lossy(&stderr).trim().to_string();
        let output = String::from_utf8_lossy(&stdout).trim().to_string();
        return Err(if !error.is_empty() {
            error
        } else if !output.is_empty() {
            output
        } else {
            "remote command failed".into()
        });
    }

    Ok(String::from_utf8_lossy(&stdout).into_owned())
}

async fn open_ssh_terminal_inner(
    app: AppHandle,
    known_hosts: Arc<KnownHostsStore>,
    request: SshConnectRequest,
    generation: u64,
) -> PuckResult<()> {
    let lease_id = format!("terminal:{}:{generation}", request.session_id);
    let session_handle = acquire_shared_ssh(known_hosts, &request, &lease_id).await?;
    if !ssh_open_is_current(&request.session_id, generation) {
        release_shared_ssh(&request.connection_id, &lease_id).await;
        return Ok(());
    }

    let channel_result = async {
        let channel = session_handle
            .channel_open_session()
            .await
            .map_err(PuckError::from)?;
        channel
            .request_pty(
                false,
                "xterm-256color",
                request.cols as u32,
                request.rows as u32,
                0,
                0,
                &[],
            )
            .await
            .map_err(PuckError::from)?;
        channel
            .request_shell(false)
            .await
            .map_err(PuckError::from)?;
        if let Some(cwd) = request.cwd.as_deref().filter(|path| !path.is_empty()) {
            let quoted = format!("'{}'", cwd.replace('\'', "'\\''"));
            channel
                .data_bytes(Bytes::from(format!("cd {quoted}\n")))
                .await
                .map_err(PuckError::from)?;
        }
        Ok::<_, PuckError>(channel)
    }
    .await;
    let mut channel = match channel_result {
        Ok(channel) => channel,
        Err(error) => {
            release_shared_ssh(&request.connection_id, &lease_id).await;
            return Err(error);
        }
    };

    if !ssh_open_is_current(&request.session_id, generation) {
        release_shared_ssh(&request.connection_id, &lease_id).await;
        return Ok(());
    }

    let session_id = request.session_id.clone();
    let app_handle = app.clone();
    let (command_tx, mut command_rx) = tokio::sync::mpsc::unbounded_channel::<SshCommand>();

    let connection_id = request.connection_id.clone();
    let io_lease_id = lease_id.clone();
    let io_task = tokio::spawn(async move {
        let mut utf8_decoder = Utf8StreamDecoder::new();
        let mut intentional_shutdown = false;
        let mut exit_emitted = false;
        loop {
            tokio::select! {
                command = command_rx.recv() => {
                    match command {
                        Some(SshCommand::Data(bytes)) => {
                            if channel.data_bytes(Bytes::from(bytes)).await.is_err() {
                                break;
                            }
                        }
                        Some(SshCommand::Resize { cols, rows }) => {
                            let _ = channel.window_change(cols, rows, 0, 0).await;
                        }
                        Some(SshCommand::Shutdown) => {
                            intentional_shutdown = true;
                            break;
                        }
                        None => break,
                    }
                }
                message = channel.wait() => {
                    match message {
                        Some(ChannelMsg::Data { data }) => {
                            emit_terminal_chunk(
                                &app_handle,
                                &session_id,
                                &mut utf8_decoder,
                                &data,
                            );
                        }
                        Some(ChannelMsg::ExtendedData { data, ext: 1, .. }) => {
                            emit_terminal_chunk(
                                &app_handle,
                                &session_id,
                                &mut utf8_decoder,
                                &data,
                            );
                        }
                        Some(ChannelMsg::ExitStatus { exit_status }) => {
                            flush_terminal_decoder(&app_handle, &session_id, &mut utf8_decoder);
                            if let Err(error) = app_handle.emit(
                                "terminal:exit",
                                TerminalExitEvent {
                                    session_id: session_id.clone(),
                                    code: Some(exit_status as i32),
                                },
                            ) {
                                tracing::warn!(?error, session_id, "failed to emit terminal:exit");
                            }
                            exit_emitted = true;
                            break;
                        }
                        Some(ChannelMsg::Eof) | None => {
                            flush_terminal_decoder(&app_handle, &session_id, &mut utf8_decoder);
                            if let Err(error) = app_handle.emit(
                                "terminal:exit",
                                TerminalExitEvent {
                                    session_id: session_id.clone(),
                                    code: None,
                                },
                            ) {
                                tracing::warn!(?error, session_id, "failed to emit terminal:exit");
                            }
                            exit_emitted = true;
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
        flush_terminal_decoder(&app_handle, &session_id, &mut utf8_decoder);
        if !exit_emitted && !intentional_shutdown {
            if let Err(error) = app_handle.emit(
                "terminal:exit",
                TerminalExitEvent {
                    session_id: session_id.clone(),
                    code: None,
                },
            ) {
                tracing::warn!(?error, session_id, "failed to emit terminal:exit");
            }
            emit_session_status(
                &app_handle,
                SessionStatusEvent {
                    session_id: session_id.clone(),
                    status: "disconnected".into(),
                    error_code: None,
                    message: None,
                    host_key: None,
                },
            );
        }
        if !exit_emitted && !intentional_shutdown {
            invalidate_shared_ssh(&connection_id).await;
        } else {
            release_shared_ssh(&connection_id, &io_lease_id).await;
        }
    });

    let insert_result = SessionManager::global().insert_terminal(
        request.session_id.clone(),
        TerminalBackend::Ssh {
            command_tx,
            io_task,
        },
        SessionKind::Ssh {
            profile: StoredSshProfile {
                connection_id: request.connection_id.clone(),
                lease_id: lease_id.clone(),
                host: request.host.clone(),
                port: request.port,
                username: request.username.clone(),
                auth_method: request.auth_method.clone(),
                private_key_path: request.private_key_path.clone(),
            },
        },
    );
    if let Err(error) = insert_result {
        release_shared_ssh(&request.connection_id, &lease_id).await;
        return Err(error);
    }
    if !ssh_open_is_current(&request.session_id, generation) {
        let _ = SessionManager::global().close_terminal(&request.session_id);
        release_shared_ssh(&request.connection_id, &lease_id).await;
        return Ok(());
    }

    emit_session_status(
        &app,
        SessionStatusEvent {
            session_id: request.session_id,
            status: "connected".into(),
            error_code: None,
            message: None,
            host_key: None,
        },
    );

    Ok(())
}

#[tauri::command]
pub fn open_ssh_terminal(
    app: AppHandle,
    known_hosts: State<'_, Arc<KnownHostsStore>>,
    request: SshConnectRequest,
) -> Result<(), String> {
    let generation = begin_ssh_open(&request.session_id);
    emit_session_status(
        &app,
        SessionStatusEvent {
            session_id: request.session_id.clone(),
            status: "creating".into(),
            error_code: None,
            message: None,
            host_key: None,
        },
    );

    let app_handle = app.clone();
    let known_hosts = known_hosts.inner().clone();
    runtime().spawn(async move {
        if let Err(error) =
            open_ssh_terminal_inner(app_handle.clone(), known_hosts, request.clone(), generation).await
        {
            emit_connection_error(&app_handle, request.session_id, error);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn reconnect_ssh_terminal(
    app: AppHandle,
    known_hosts: State<'_, Arc<KnownHostsStore>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let profile = SessionManager::global()
        .ssh_profile(&session_id)
        .ok_or_else(|| "ssh profile not found for session".to_string())?;

    emit_session_status(
        &app,
        SessionStatusEvent {
            session_id: session_id.clone(),
            status: "reconnecting".into(),
            error_code: None,
            message: None,
            host_key: None,
        },
    );

    release_shared_ssh(&profile.connection_id, &profile.lease_id).await;
    let _ = SessionManager::global().close_terminal(&session_id);

    open_ssh_terminal(
        app,
        known_hosts,
        SshConnectRequest {
            session_id,
            connection_id: profile.connection_id,
            host: profile.host,
            port: profile.port,
            username: profile.username,
            auth_method: profile.auth_method,
            private_key_path: profile.private_key_path,
            password: None,
            passphrase: None,
            cwd: None,
            cols,
            rows,
        },
    )
}

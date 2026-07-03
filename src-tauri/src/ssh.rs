use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use bytes::Bytes;
use russh::client;
use russh::ChannelMsg;
use russh::keys::{decode_secret_key, PrivateKeyWithHashAlg, PublicKey};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use crate::credential::read_credential;
use crate::error::{host_key_prompt, puck_err, HostKeyPrompt, PuckError, PuckResult};
use crate::known_hosts::KnownHostsStore;
use crate::runtime::runtime;
use crate::session::{
    emit_connection_error, emit_session_status, SessionKind, SessionManager,
    SessionStatusEvent, SshCommand, StoredSshProfile, TerminalBackend,
};
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
    let _ = app.emit(
        "terminal:data",
        TerminalDataEvent {
            session_id: session_id.to_string(),
            data: payload,
        },
    );
}

fn flush_terminal_decoder(app: &AppHandle, session_id: &str, decoder: &mut Utf8StreamDecoder) {
    let tail = decoder.finish();
    if tail.is_empty() {
        return;
    }
    let _ = app.emit(
        "terminal:data",
        TerminalDataEvent {
            session_id: session_id.to_string(),
            data: tail,
        },
    );
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
        *self.pending.lock().unwrap() = Some(host_key_prompt(
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
            if let Some(prompt) = pending.lock().unwrap().take() {
                return Err(PuckError::HostKeyUnknown(prompt));
            }
            return Err(PuckError::from(error));
        }
        Err(_) => return Err(PuckError::network("connection timed out")),
    };

    match tokio::time::timeout(SSH_AUTH_TIMEOUT, authenticate(&mut session, request)).await {
        Ok(Ok(())) => Ok(session),
        Ok(Err(error)) => Err(error),
        Err(_) => Err(PuckError::network("authentication timed out")),
    }
}

async fn authenticate(
    session: &mut client::Handle<SshClientHandler>,
    request: &SshConnectRequest,
) -> PuckResult<()> {
    let username = request.username.as_str();

    let auth_result = match request.auth_method.as_str() {
        "password" => {
            let password = request
                .password
                .clone()
                .or_else(|| {
                    read_credential(&request.connection_id, "password")
                        .ok()
                        .flatten()
                })
                .ok_or_else(|| PuckError::config("missing credential: password"))?;
            session
                .authenticate_password(username, password)
                .await
                .map_err(PuckError::from)?
        }
        "privateKey" => {
            let path = request
                .private_key_path
                .as_ref()
                .ok_or_else(|| PuckError::config("private key path is required"))?;
            let content = std::fs::read_to_string(path).map_err(PuckError::from)?;
            let passphrase = request
                .passphrase
                .clone()
                .or(read_credential(&request.connection_id, "passphrase")?);
            let key = decode_secret_key(&content, passphrase.as_deref())
                .map_err(|error| PuckError::auth_failed(error.to_string()))?;
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

static SSH_EXEC_HANDLES: OnceLock<Mutex<HashMap<String, Arc<client::Handle<SshClientHandler>>>>> =
    OnceLock::new();

fn ssh_exec_handles() -> &'static Mutex<HashMap<String, Arc<client::Handle<SshClientHandler>>>> {
    SSH_EXEC_HANDLES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn store_ssh_exec_handle(session_id: &str, handle: Arc<client::Handle<SshClientHandler>>) {
    if let Ok(mut handles) = ssh_exec_handles().lock() {
        handles.insert(session_id.to_string(), handle);
    }
}

pub fn remove_ssh_exec_handle(session_id: &str) {
    if let Ok(mut handles) = ssh_exec_handles().lock() {
        handles.remove(session_id);
    }
}

pub fn ssh_exec_handle(session_id: &str) -> Option<Arc<client::Handle<SshClientHandler>>> {
    ssh_exec_handles()
        .lock()
        .ok()?
        .get(session_id)
        .cloned()
}

pub async fn exec_remote_command(
    session_id: &str,
    command: &str,
) -> Result<String, String> {
    match tokio::time::timeout(
        REMOTE_EXEC_TIMEOUT,
        exec_remote_command_inner(session_id, command),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => Err("remote command timed out".into()),
    }
}

async fn exec_remote_command_inner(
    session_id: &str,
    command: &str,
) -> Result<String, String> {
    let handle = ssh_exec_handle(session_id).ok_or_else(|| "ssh session not found".to_string())?;
    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|error| error.to_string())?;
    channel
        .exec(true, command)
        .await
        .map_err(|error| error.to_string())?;

    let mut stdout = Vec::new();
    let mut exit_status = None;

    while let Some(message) = channel.wait().await {
        match message {
            ChannelMsg::Data { data } => stdout.extend_from_slice(&data),
            ChannelMsg::ExitStatus { exit_status: code } => exit_status = Some(code),
            ChannelMsg::Eof => break,
            _ => {}
        }
    }

    let output = String::from_utf8_lossy(&stdout).trim().to_string();
    if exit_status.unwrap_or(1) != 0 {
        return Err(if output.is_empty() {
            "remote command failed".into()
        } else {
            output
        });
    }

    Ok(output)
}

async fn open_ssh_terminal_inner(
    app: AppHandle,
    known_hosts: Arc<KnownHostsStore>,
    request: SshConnectRequest,
) -> PuckResult<()> {
    let session_handle = Arc::new(connect_authenticated(known_hosts, &request).await?);

    let mut channel = session_handle
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

    let session_id = request.session_id.clone();
    let app_handle = app.clone();
    store_ssh_exec_handle(&session_id, Arc::clone(&session_handle));
    let (command_tx, mut command_rx) = tokio::sync::mpsc::unbounded_channel::<SshCommand>();

    let io_handle = Arc::clone(&session_handle);
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
                            let _ = app_handle.emit(
                                "terminal:exit",
                                TerminalExitEvent {
                                    session_id: session_id.clone(),
                                    code: Some(exit_status as i32),
                                },
                            );
                            exit_emitted = true;
                            break;
                        }
                        Some(ChannelMsg::Eof) | None => {
                            flush_terminal_decoder(&app_handle, &session_id, &mut utf8_decoder);
                            let _ = app_handle.emit(
                                "terminal:exit",
                                TerminalExitEvent {
                                    session_id: session_id.clone(),
                                    code: None,
                                },
                            );
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
            let _ = app_handle.emit(
                "terminal:exit",
                TerminalExitEvent {
                    session_id: session_id.clone(),
                    code: None,
                },
            );
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
        remove_ssh_exec_handle(&session_id);
        let _ = io_handle
            .disconnect(russh::Disconnect::ByApplication, "", "en")
            .await;
    });

    SessionManager::global().insert_terminal(
        request.session_id.clone(),
        TerminalBackend::Ssh {
            command_tx,
            io_task,
        },
        SessionKind::Ssh {
            profile: StoredSshProfile {
                connection_id: request.connection_id.clone(),
                host: request.host.clone(),
                port: request.port,
                username: request.username.clone(),
                auth_method: request.auth_method.clone(),
                private_key_path: request.private_key_path.clone(),
            },
        },
    )?;

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
            open_ssh_terminal_inner(app_handle.clone(), known_hosts, request.clone()).await
        {
            emit_connection_error(&app_handle, request.session_id, error);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn reconnect_ssh_terminal(
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

    let _ = SessionManager::global().close_terminal(&session_id);
    remove_ssh_exec_handle(&session_id);

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
            cols,
            rows,
        },
    )
}

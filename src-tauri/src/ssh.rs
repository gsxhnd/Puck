use std::sync::{Arc, Mutex};

use bytes::Bytes;
use russh::client;
use russh::ChannelMsg;
use russh::keys::{decode_secret_key, PrivateKeyWithHashAlg, PublicKey};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use crate::credential::{read_credential, require_credential};
use crate::error::{host_key_prompt, puck_err, HostKeyPrompt, PuckError, PuckResult};
use crate::known_hosts::KnownHostsStore;
use crate::runtime::runtime;
use crate::session::{
    emit_connection_error, emit_session_status, SessionKind, SessionManager,
    SessionStatusEvent, SshCommand, StoredSshProfile, TerminalBackend,
};
use crate::terminal::{TerminalDataEvent, TerminalExitEvent};

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
    pub cols: u16,
    pub rows: u16,
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

    let config = Arc::new(client::Config::default());
    let mut session = match client::connect(
        config,
        (request.host.as_str(), request.port),
        handler,
    )
    .await
    {
        Ok(session) => session,
        Err(error) => {
            if let Some(prompt) = pending.lock().unwrap().take() {
                return Err(PuckError::HostKeyUnknown(prompt));
            }
            return Err(PuckError::from(error));
        }
    };

    authenticate(&mut session, request).await?;
    Ok(session)
}

async fn authenticate(
    session: &mut client::Handle<SshClientHandler>,
    request: &SshConnectRequest,
) -> PuckResult<()> {
    let username = request.username.as_str();

    let auth_result = match request.auth_method.as_str() {
        "password" => {
            let password =
                require_credential(&request.connection_id, "password").map_err(PuckError::config)?;
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
            let passphrase = read_credential(&request.connection_id, "passphrase")?;
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

async fn open_ssh_terminal_inner(
    app: AppHandle,
    known_hosts: Arc<KnownHostsStore>,
    request: SshConnectRequest,
) -> PuckResult<()> {
    let session_handle = connect_authenticated(known_hosts, &request).await?;

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
    let (command_tx, mut command_rx) = tokio::sync::mpsc::unbounded_channel::<SshCommand>();

    let io_task = tokio::spawn(async move {
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
                        Some(SshCommand::Shutdown) | None => break,
                    }
                }
                message = channel.wait() => {
                    match message {
                        Some(ChannelMsg::Data { data }) => {
                            let payload = String::from_utf8_lossy(&data).into_owned();
                            let _ = app_handle.emit(
                                "terminal:data",
                                TerminalDataEvent {
                                    session_id: session_id.clone(),
                                    data: payload,
                                },
                            );
                        }
                        Some(ChannelMsg::ExtendedData { data, ext: 1, .. }) => {
                            let payload = String::from_utf8_lossy(&data).into_owned();
                            let _ = app_handle.emit(
                                "terminal:data",
                                TerminalDataEvent {
                                    session_id: session_id.clone(),
                                    data: payload,
                                },
                            );
                        }
                        Some(ChannelMsg::ExitStatus { exit_status }) => {
                            let _ = app_handle.emit(
                                "terminal:exit",
                                TerminalExitEvent {
                                    session_id: session_id.clone(),
                                    code: Some(exit_status as i32),
                                },
                            );
                            break;
                        }
                        Some(ChannelMsg::Eof) | None => {
                            let _ = app_handle.emit(
                                "terminal:exit",
                                TerminalExitEvent {
                                    session_id: session_id.clone(),
                                    code: None,
                                },
                            );
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
        let _ = session_handle
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
            cols,
            rows,
        },
    )
}

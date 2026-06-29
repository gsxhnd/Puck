use std::sync::Arc;

use russh_sftp::client::SftpSession;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::error::{puck_err, PuckError, PuckResult};
use crate::known_hosts::KnownHostsStore;
use crate::runtime::{block_on, runtime};
use crate::session::{
    emit_connection_error, emit_session_status, RemoteFileEntry, SessionManager,
    SessionStatusEvent, SftpCommand, SftpSessionEntry, StoredSshProfile,
};
use crate::ssh::{connect_authenticated, SshConnectRequest};
use crate::transfer::{emit_transfer_done, emit_transfer_error, emit_transfer_progress};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenFileConnectionRequest {
    pub session_id: String,
    pub connection_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub private_key_path: Option<String>,
    pub password: Option<String>,
    pub passphrase: Option<String>,
    pub default_directory: Option<String>,
}

fn to_ssh_request(request: &OpenFileConnectionRequest) -> SshConnectRequest {
    SshConnectRequest {
        session_id: request.session_id.clone(),
        connection_id: request.connection_id.clone(),
        host: request.host.clone(),
        port: request.port,
        username: request.username.clone(),
        auth_method: request.auth_method.clone(),
        private_key_path: request.private_key_path.clone(),
        password: request.password.clone(),
        passphrase: request.passphrase.clone(),
        cols: 80,
        rows: 24,
    }
}

async fn open_sftp_inner(
    app: AppHandle,
    known_hosts: Arc<KnownHostsStore>,
    request: OpenFileConnectionRequest,
) -> PuckResult<()> {
    let ssh_request = to_ssh_request(&request);
    let session_handle = connect_authenticated(known_hosts, &ssh_request).await?;

    let mut channel = session_handle
        .channel_open_session()
        .await
        .map_err(PuckError::from)?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(PuckError::from)?;
    let stream = channel.into_stream();

    let cwd = request
        .default_directory
        .clone()
        .filter(|path| !path.is_empty())
        .unwrap_or_else(|| "/".to_string());

    let session_id = request.session_id.clone();
    let app_handle = app.clone();
    let (command_tx, mut command_rx) = tokio::sync::mpsc::unbounded_channel::<SftpCommand>();

    let io_task = tokio::spawn(async move {
        let sftp = match SftpSession::new(stream).await {
            Ok(session) => session,
            Err(error) => {
                let _ = app_handle.emit(
                    "session:status",
                    SessionStatusEvent {
                        session_id: session_id.clone(),
                        status: "failed".into(),
                        error_code: Some("protocol_error".into()),
                        message: Some(error.to_string()),
                        host_key: None,
                    },
                );
                let _ = session_handle
                    .disconnect(russh::Disconnect::ByApplication, "", "en")
                    .await;
                return;
            }
        };

        while let Some(command) = command_rx.recv().await {
            match command {
                SftpCommand::ListDir { path, reply } => {
                    let _ = reply.send(list_dir(&sftp, &path).await);
                }
                SftpCommand::Mkdir { path, reply } => {
                    let result = sftp
                        .create_dir(&path)
                        .await
                        .map(|_| ())
                        .map_err(|error| error.to_string());
                    let _ = reply.send(result);
                }
                SftpCommand::Remove { path, reply } => {
                    let _ = reply.send(remove_path(&sftp, &path).await);
                }
                SftpCommand::Rename {
                    old_path,
                    new_path,
                    reply,
                } => {
                    let result = sftp
                        .rename(&old_path, &new_path)
                        .await
                        .map(|_| ())
                        .map_err(|error| error.to_string());
                    let _ = reply.send(result);
                }
                SftpCommand::Upload {
                    transfer_id,
                    local_path,
                    remote_path,
                    app,
                } => {
                    run_upload(&sftp, app, transfer_id, local_path, remote_path).await;
                }
                SftpCommand::Download {
                    transfer_id,
                    local_path,
                    remote_path,
                    app,
                } => {
                    run_download(&sftp, app, transfer_id, local_path, remote_path).await;
                }
                SftpCommand::Shutdown => break,
            }
        }

        let _ = sftp.close().await;
        let _ = session_handle
            .disconnect(russh::Disconnect::ByApplication, "", "en")
            .await;
        let _ = app_handle.emit(
            "session:status",
            SessionStatusEvent {
                session_id,
                status: "disconnected".into(),
                error_code: None,
                message: None,
                host_key: None,
            },
        );
    });

    SessionManager::global().insert_sftp(
        request.session_id.clone(),
        SftpSessionEntry {
            profile: StoredSshProfile {
                connection_id: request.connection_id,
                host: request.host,
                port: request.port,
                username: request.username,
                auth_method: request.auth_method,
                private_key_path: request.private_key_path,
            },
            cwd,
            command_tx: command_tx.clone(),
            io_task,
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

async fn list_dir(sftp: &SftpSession, path: &str) -> Result<Vec<RemoteFileEntry>, String> {
    let read_dir = sftp.read_dir(path).await.map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for entry in read_dir {
        let metadata = entry.metadata();
        files.push(RemoteFileEntry {
            name: entry.file_name(),
            path: entry.path(),
            is_dir: metadata.is_dir(),
            size: metadata.size.unwrap_or(0),
            modified: metadata.mtime.map(|value| value as u64),
            permissions: metadata.permissions.map(|value| format!("{value:o}")),
        });
    }
    files.sort_by(|left, right| right.is_dir.cmp(&left.is_dir).then(left.name.cmp(&right.name)));
    Ok(files)
}

async fn remove_path(sftp: &SftpSession, path: &str) -> Result<(), String> {
    if sftp
        .metadata(path)
        .await
        .map(|meta| meta.is_dir())
        .unwrap_or(false)
    {
        sftp.remove_dir(path).await.map_err(|e| e.to_string())
    } else {
        sftp.remove_file(path).await.map_err(|e| e.to_string())
    }
}

async fn run_upload(
    sftp: &SftpSession,
    app: AppHandle,
    transfer_id: String,
    local_path: String,
    remote_path: String,
) {
    let result = async {
        let mut local = tokio::fs::File::open(&local_path)
            .await
            .map_err(|error| error.to_string())?;
        let total = local.metadata().await.map_err(|error| error.to_string())?.len();
        let mut remote = sftp
            .create(&remote_path)
            .await
            .map_err(|error| error.to_string())?;
        let mut transferred = 0u64;
        let mut buffer = vec![0u8; 64 * 1024];
        loop {
            let read = local.read(&mut buffer).await.map_err(|e| e.to_string())?;
            if read == 0 {
                break;
            }
            remote
                .write_all(&buffer[..read])
                .await
                .map_err(|error| error.to_string())?;
            transferred += read as u64;
            emit_transfer_progress(&app, &transfer_id, transferred, Some(total));
        }
        remote.shutdown().await.map_err(|error| error.to_string())?;
        Ok::<(), String>(())
    }
    .await;

    match result {
        Ok(()) => emit_transfer_done(&app, &transfer_id),
        Err(message) => emit_transfer_error(&app, &transfer_id, message),
    }
}

async fn run_download(
    sftp: &SftpSession,
    app: AppHandle,
    transfer_id: String,
    local_path: String,
    remote_path: String,
) {
    let result = async {
        let mut remote = sftp
            .open(&remote_path)
            .await
            .map_err(|error| error.to_string())?;
        let total = remote
            .metadata()
            .await
            .ok()
            .and_then(|meta| meta.size);
        let mut local = tokio::fs::File::create(&local_path)
            .await
            .map_err(|error| error.to_string())?;
        let mut transferred = 0u64;
        let mut buffer = vec![0u8; 64 * 1024];
        loop {
            let read = remote.read(&mut buffer).await.map_err(|e| e.to_string())?;
            if read == 0 {
                break;
            }
            local
                .write_all(&buffer[..read])
                .await
                .map_err(|error| error.to_string())?;
            transferred += read as u64;
            emit_transfer_progress(&app, &transfer_id, transferred, total);
        }
        Ok::<(), String>(())
    }
    .await;

    match result {
        Ok(()) => emit_transfer_done(&app, &transfer_id),
        Err(message) => emit_transfer_error(&app, &transfer_id, message),
    }
}

#[tauri::command]
pub fn open_file_connection(
    app: AppHandle,
    known_hosts: State<'_, Arc<KnownHostsStore>>,
    request: OpenFileConnectionRequest,
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
            open_sftp_inner(app_handle.clone(), known_hosts, request.clone()).await
        {
            emit_connection_error(&app_handle, request.session_id, error);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn list_remote_dir(
    session_id: String,
    path: Option<String>,
) -> Result<Vec<RemoteFileEntry>, String> {
    let manager = SessionManager::global();
    let target = path.unwrap_or_else(|| {
        manager
            .sftp_cwd(&session_id)
            .unwrap_or_else(|| "/".to_string())
    });
    let command_tx = manager
        .sftp_command_tx(&session_id)
        .ok_or_else(|| "sftp session not found".to_string())?;
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    command_tx
        .send(SftpCommand::ListDir {
            path: target.clone(),
            reply: reply_tx,
        })
        .map_err(|_| "sftp channel closed".to_string())?;
    let entries = block_on(async { reply_rx.await })
        .map_err(|_| "sftp response channel closed".to_string())??;
    manager
        .set_sftp_cwd(&session_id, target)
        .map_err(|error| error.to_string())?;
    Ok(entries)
}

#[tauri::command]
pub fn mkdir_remote(session_id: String, path: String) -> Result<(), String> {
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    send_command(
        session_id,
        SftpCommand::Mkdir {
            path,
            reply: reply_tx,
        },
    )?;
    block_on(async { reply_rx.await }).map_err(|_| "sftp response channel closed".to_string())?
}

#[tauri::command]
pub fn delete_remote(session_id: String, path: String) -> Result<(), String> {
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    send_command(
        session_id,
        SftpCommand::Remove { path, reply: reply_tx },
    )?;
    block_on(async { reply_rx.await }).map_err(|_| "sftp response channel closed".to_string())?
}

#[tauri::command]
pub fn rename_remote(session_id: String, old_path: String, new_path: String) -> Result<(), String> {
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    send_command(
        session_id,
        SftpCommand::Rename {
            old_path,
            new_path,
            reply: reply_tx,
        },
    )?;
    block_on(async { reply_rx.await }).map_err(|_| "sftp response channel closed".to_string())?
}

#[tauri::command]
pub fn start_transfer(
    app: AppHandle,
    session_id: String,
    transfer_id: String,
    direction: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    let command_tx = SessionManager::global()
        .sftp_command_tx(&session_id)
        .ok_or_else(|| "sftp session not found".to_string())?;
    let command = match direction.as_str() {
        "upload" => SftpCommand::Upload {
            transfer_id,
            local_path,
            remote_path,
            app,
        },
        "download" => SftpCommand::Download {
            transfer_id,
            local_path,
            remote_path,
            app,
        },
        _ => return Err("invalid transfer direction".into()),
    };
    command_tx
        .send(command)
        .map_err(|_| "sftp channel closed".to_string())
}

fn send_command(session_id: String, command: SftpCommand) -> Result<(), String> {
    SessionManager::global()
        .sftp_command_tx(&session_id)
        .ok_or_else(|| "sftp session not found".to_string())?
        .send(command)
        .map_err(|_| "sftp channel closed".to_string())
}

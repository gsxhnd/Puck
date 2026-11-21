use std::sync::Arc;

use russh_sftp::client::SftpSession;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::error::{PuckError, PuckResult};
use crate::known_hosts::KnownHostsStore;
use crate::runtime::runtime;
use crate::session::{
    emit_connection_error, emit_session_status, RemoteFileEntry, SessionManager,
    SessionStatusEvent, SftpCommand, SftpSessionEntry,
};
use crate::ssh::{
    acquire_shared_ssh, begin_ssh_open, release_shared_ssh, ssh_open_is_current,
    SshConnectRequest,
};

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
        cwd: request.default_directory.clone(),
        cols: 80,
        rows: 24,
    }
}

async fn open_sftp_channel(
    session_handle: &russh::client::Handle<crate::ssh::SshClientHandler>,
) -> PuckResult<SftpSession> {
    let channel = session_handle
        .channel_open_session()
        .await
        .map_err(PuckError::from)?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(PuckError::from)?;
    let stream = channel.into_stream();
    SftpSession::new(stream)
        .await
        .map_err(|error| PuckError::protocol(error.to_string()))
}

async fn await_sftp_reply<T>(
    reply_rx: tokio::sync::oneshot::Receiver<Result<T, String>>,
) -> Result<T, String> {
    reply_rx
        .await
        .map_err(|_| "sftp response channel closed".to_string())?
}

async fn open_sftp_inner(
    app: AppHandle,
    known_hosts: Arc<KnownHostsStore>,
    request: OpenFileConnectionRequest,
    generation: u64,
) -> PuckResult<()> {
    let ssh_request = to_ssh_request(&request);
    let lease_id = format!("sftp:{}:{generation}", request.session_id);
    let session_handle = acquire_shared_ssh(known_hosts, &ssh_request, &lease_id).await?;
    if !ssh_open_is_current(&request.session_id, generation) {
        release_shared_ssh(&request.connection_id, &lease_id).await;
        return Ok(());
    }

    let sftp = match open_sftp_channel(session_handle.as_ref()).await {
        Ok(session) => session,
        Err(error) => {
            release_shared_ssh(&request.connection_id, &lease_id).await;
            return Err(error);
        }
    };

    if !ssh_open_is_current(&request.session_id, generation) {
        let _ = sftp.close().await;
        release_shared_ssh(&request.connection_id, &lease_id).await;
        return Ok(());
    }

    let cwd = request
        .default_directory
        .clone()
        .filter(|path| !path.is_empty())
        .unwrap_or_else(|| "/".to_string());

    let session_id = request.session_id.clone();
    let app_handle = app.clone();
    let (command_tx, mut command_rx) = tokio::sync::mpsc::unbounded_channel::<SftpCommand>();

    let connection_id = request.connection_id.clone();
    let io_lease_id = lease_id.clone();
    let io_task = tokio::spawn(async move {
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
                SftpCommand::ReadFile { path, reply } => {
                    let _ = reply.send(read_remote_file(&sftp, &path).await);
                }
                SftpCommand::WriteFile {
                    path,
                    content,
                    reply,
                } => {
                    let _ = reply.send(write_remote_file(&sftp, &path, &content).await);
                }
                SftpCommand::Shutdown => break,
            }
        }

        let _ = sftp.close().await;
        release_shared_ssh(&connection_id, &io_lease_id).await;
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

    let insert_result = SessionManager::global().insert_sftp(
        request.session_id.clone(),
        SftpSessionEntry {
            connection_id: request.connection_id.clone(),
            lease_id: lease_id.clone(),
            cwd,
            command_tx: command_tx.clone(),
            io_task,
        },
    );
    if let Err(error) = insert_result {
        release_shared_ssh(&request.connection_id, &lease_id).await;
        return Err(error);
    }
    if !ssh_open_is_current(&request.session_id, generation) {
        let _ = SessionManager::global().close_sftp(&request.session_id);
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

const MAX_EDITOR_FILE_BYTES: u64 = 2 * 1024 * 1024;

async fn read_remote_file(sftp: &SftpSession, path: &str) -> Result<String, String> {
    let mut remote = sftp.open(path).await.map_err(|error| error.to_string())?;
    let size = remote
        .metadata()
        .await
        .ok()
        .and_then(|meta| meta.size)
        .unwrap_or(0);
    if size > MAX_EDITOR_FILE_BYTES {
        return Err("File is too large to edit".into());
    }

    let mut buffer = Vec::new();
    remote
        .read_to_end(&mut buffer)
        .await
        .map_err(|error| error.to_string())?;
    if buffer.len() as u64 > MAX_EDITOR_FILE_BYTES {
        return Err("File is too large to edit".into());
    }

    String::from_utf8(buffer).map_err(|_| "File is not valid UTF-8".into())
}

async fn write_remote_file(sftp: &SftpSession, path: &str, content: &str) -> Result<(), String> {
    let mut remote = sftp
        .create(path)
        .await
        .map_err(|error| error.to_string())?;
    remote
        .write_all(content.as_bytes())
        .await
        .map_err(|error| error.to_string())?;
    remote
        .shutdown()
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_file_connection(
    app: AppHandle,
    known_hosts: State<'_, Arc<KnownHostsStore>>,
    request: OpenFileConnectionRequest,
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
            open_sftp_inner(app_handle.clone(), known_hosts, request.clone(), generation).await
        {
            emit_connection_error(&app_handle, request.session_id, error);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn list_remote_dir(
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
    let entries = await_sftp_reply(reply_rx).await?;
    manager
        .set_sftp_cwd(&session_id, target)
        .map_err(|error| error.to_string())?;
    Ok(entries)
}

#[tauri::command]
pub async fn mkdir_remote(session_id: String, path: String) -> Result<(), String> {
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    send_command(
        session_id,
        SftpCommand::Mkdir {
            path,
            reply: reply_tx,
        },
    )?;
    await_sftp_reply(reply_rx).await
}

#[tauri::command]
pub async fn delete_remote(session_id: String, path: String) -> Result<(), String> {
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    send_command(
        session_id,
        SftpCommand::Remove { path, reply: reply_tx },
    )?;
    await_sftp_reply(reply_rx).await
}

#[tauri::command]
pub async fn rename_remote(
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    send_command(
        session_id,
        SftpCommand::Rename {
            old_path,
            new_path,
            reply: reply_tx,
        },
    )?;
    await_sftp_reply(reply_rx).await
}

#[tauri::command]
pub async fn read_remote_file_command(session_id: String, path: String) -> Result<String, String> {
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    send_command(
        session_id,
        SftpCommand::ReadFile {
            path,
            reply: reply_tx,
        },
    )?;
    await_sftp_reply(reply_rx).await
}

#[tauri::command]
pub async fn write_remote_file_command(
    session_id: String,
    path: String,
    content: String,
) -> Result<(), String> {
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    send_command(
        session_id,
        SftpCommand::WriteFile {
            path,
            content,
            reply: reply_tx,
        },
    )?;
    await_sftp_reply(reply_rx).await
}

fn send_command(session_id: String, command: SftpCommand) -> Result<(), String> {
    SessionManager::global()
        .sftp_command_tx(&session_id)
        .ok_or_else(|| "sftp session not found".to_string())?
        .send(command)
        .map_err(|_| "sftp channel closed".to_string())
}

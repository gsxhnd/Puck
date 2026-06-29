use std::collections::HashMap;
use std::io::Write;
use std::sync::{Mutex, OnceLock};

use portable_pty::{Child, MasterPty};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{HostKeyPrompt, PuckError, PuckResult};

#[derive(Debug, Clone)]
pub struct StoredSshProfile {
    pub connection_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub private_key_path: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusEvent {
    pub session_id: String,
    pub status: String,
    pub error_code: Option<String>,
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host_key: Option<HostKeyPrompt>,
}

pub fn emit_session_status(app: &AppHandle, event: SessionStatusEvent) {
    let _ = app.emit("session:status", event);
}

pub fn emit_connection_error(app: &AppHandle, session_id: String, error: PuckError) {
    let payload = error.to_payload();
    if let Some(host_key) = payload.host_key {
        emit_session_status(
            app,
            SessionStatusEvent {
                session_id,
                status: "creating".into(),
                error_code: Some("host_key_unknown".into()),
                message: None,
                host_key: Some(host_key),
            },
        );
        return;
    }

    emit_session_status(
        app,
        SessionStatusEvent {
            session_id,
            status: "failed".into(),
            error_code: Some(payload.code),
            message: Some(payload.message),
            host_key: None,
        },
    );
}

#[derive(Clone)]
pub enum SessionKind {
    Local,
    Ssh { profile: StoredSshProfile },
    Sftp { profile: StoredSshProfile, cwd: String },
}

pub enum SshCommand {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Shutdown,
}

pub enum TerminalBackend {
    Local {
        master: Box<dyn MasterPty + Send>,
        child: Box<dyn Child + Send + Sync>,
        writer: Box<dyn Write + Send>,
    },
    Ssh {
        command_tx: tokio::sync::mpsc::UnboundedSender<SshCommand>,
        io_task: tokio::task::JoinHandle<()>,
    },
}

struct TerminalEntry {
    backend: TerminalBackend,
    kind: SessionKind,
}

pub struct SessionManager {
    terminals: Mutex<HashMap<String, TerminalEntry>>,
    sftp_sessions: Mutex<HashMap<String, SftpSessionEntry>>,
}

pub struct SftpSessionEntry {
    pub profile: StoredSshProfile,
    pub cwd: String,
    pub command_tx: tokio::sync::mpsc::UnboundedSender<SftpCommand>,
    pub io_task: tokio::task::JoinHandle<()>,
}

pub enum SftpCommand {
    ListDir {
        path: String,
        reply: tokio::sync::oneshot::Sender<Result<Vec<RemoteFileEntry>, String>>,
    },
    Mkdir {
        path: String,
        reply: tokio::sync::oneshot::Sender<Result<(), String>>,
    },
    Remove {
        path: String,
        reply: tokio::sync::oneshot::Sender<Result<(), String>>,
    },
    Rename {
        old_path: String,
        new_path: String,
        reply: tokio::sync::oneshot::Sender<Result<(), String>>,
    },
    Upload {
        transfer_id: String,
        local_path: String,
        remote_path: String,
        app: AppHandle,
    },
    Download {
        transfer_id: String,
        local_path: String,
        remote_path: String,
        app: AppHandle,
    },
    Shutdown,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub permissions: Option<String>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
            sftp_sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn global() -> &'static SessionManager {
        static MANAGER: OnceLock<SessionManager> = OnceLock::new();
        MANAGER.get_or_init(SessionManager::new)
    }

    pub fn insert_terminal(
        &self,
        session_id: String,
        backend: TerminalBackend,
        kind: SessionKind,
    ) -> PuckResult<()> {
        let mut terminals = self
            .terminals
            .lock()
            .map_err(|_| PuckError::Message("failed to lock sessions".into()))?;
        if terminals.contains_key(&session_id) {
            return Err(PuckError::Message(format!(
                "session already exists: {session_id}"
            )));
        }
        terminals.insert(session_id, TerminalEntry { backend, kind });
        Ok(())
    }

    pub fn ssh_profile(&self, session_id: &str) -> Option<StoredSshProfile> {
        let terminals = self.terminals.lock().ok()?;
        let entry = terminals.get(session_id)?;
        match &entry.kind {
            SessionKind::Ssh { profile } => Some(profile.clone()),
            _ => None,
        }
    }

    pub fn write_terminal(&self, session_id: &str, data: &str) -> PuckResult<()> {
        let mut terminals = self
            .terminals
            .lock()
            .map_err(|_| PuckError::Message("failed to lock sessions".into()))?;
        let entry = terminals
            .get_mut(session_id)
            .ok_or_else(|| PuckError::Message(format!("session not found: {session_id}")))?;

        match &mut entry.backend {
            TerminalBackend::Local { writer, .. } => {
                writer
                    .write_all(data.as_bytes())
                    .map_err(PuckError::from)?;
                writer.flush().map_err(PuckError::from)?;
            }
            TerminalBackend::Ssh { command_tx, .. } => {
                command_tx
                    .send(SshCommand::Data(data.as_bytes().to_vec()))
                    .map_err(|_| PuckError::protocol("ssh channel closed"))?;
            }
        }
        Ok(())
    }

    pub fn resize_terminal(&self, session_id: &str, cols: u16, rows: u16) -> PuckResult<()> {
        let terminals = self
            .terminals
            .lock()
            .map_err(|_| PuckError::Message("failed to lock sessions".into()))?;
        let entry = terminals
            .get(session_id)
            .ok_or_else(|| PuckError::Message(format!("session not found: {session_id}")))?;

        match &entry.backend {
            TerminalBackend::Local { master, .. } => {
                master
                    .resize(portable_pty::PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    })
                    .map_err(|error| PuckError::Message(error.to_string()))?;
            }
            TerminalBackend::Ssh { command_tx, .. } => {
                command_tx
                    .send(SshCommand::Resize {
                        cols: cols as u32,
                        rows: rows as u32,
                    })
                    .map_err(|_| PuckError::protocol("ssh channel closed"))?;
            }
        }
        Ok(())
    }

    pub fn close_terminal(&self, session_id: &str) -> bool {
        let mut terminals = match self.terminals.lock() {
            Ok(guard) => guard,
            Err(_) => return false,
        };
        let Some(entry) = terminals.remove(session_id) else {
            return false;
        };
        if let TerminalBackend::Ssh { command_tx, .. } = &entry.backend {
            let _ = command_tx.send(SshCommand::Shutdown);
        }
        if let TerminalBackend::Local { mut child, .. } = entry.backend {
            let _ = child.kill();
            let _ = child.wait();
        }
        true
    }

    pub fn insert_sftp(&self, session_id: String, entry: SftpSessionEntry) -> PuckResult<()> {
        let mut sessions = self
            .sftp_sessions
            .lock()
            .map_err(|_| PuckError::Message("failed to lock sftp sessions".into()))?;
        if sessions.contains_key(&session_id) {
            return Err(PuckError::Message(format!(
                "sftp session already exists: {session_id}"
            )));
        }
        sessions.insert(session_id, entry);
        Ok(())
    }

    pub fn sftp_cwd(&self, session_id: &str) -> Option<String> {
        let sessions = self.sftp_sessions.lock().ok()?;
        sessions.get(session_id).map(|entry| entry.cwd.clone())
    }

    pub fn set_sftp_cwd(&self, session_id: &str, cwd: String) -> PuckResult<()> {
        let mut sessions = self
            .sftp_sessions
            .lock()
            .map_err(|_| PuckError::Message("failed to lock sftp sessions".into()))?;
        let entry = sessions
            .get_mut(session_id)
            .ok_or_else(|| PuckError::Message(format!("sftp session not found: {session_id}")))?;
        entry.cwd = cwd;
        Ok(())
    }

    pub fn sftp_command_tx(
        &self,
        session_id: &str,
    ) -> Option<tokio::sync::mpsc::UnboundedSender<SftpCommand>> {
        let sessions = self.sftp_sessions.lock().ok()?;
        sessions.get(session_id).map(|entry| entry.command_tx.clone())
    }

    pub fn close_sftp(&self, session_id: &str) -> Option<SftpSessionEntry> {
        let mut sessions = self.sftp_sessions.lock().ok()?;
        let entry = sessions.remove(session_id)?;
        let _ = entry.command_tx.send(SftpCommand::Shutdown);
        Some(entry)
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

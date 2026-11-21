use std::io::Read;

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::puck_err;
use crate::runtime::runtime;
use crate::session::{SessionKind, SessionManager, TerminalBackend};
use crate::ssh::{cancel_ssh_open, release_shared_ssh};
use crate::shell::{find_shell, ShellInfo};
use crate::utf8_stream::Utf8StreamDecoder;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalDataEvent {
    pub session_id: String,
    pub data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExitEvent {
    pub session_id: String,
    pub code: Option<i32>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenLocalTerminalResult {
    pub session_id: String,
    pub shell: ShellInfo,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemIdentity {
    pub username: String,
    pub hostname: String,
}

#[tauri::command]
pub fn get_system_identity() -> SystemIdentity {
    let username = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "user".into());

    let hostname = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| read_hostname().unwrap_or_else(|| "localhost".into()));

    SystemIdentity { username, hostname }
}

fn read_hostname() -> Option<String> {
    #[cfg(unix)]
    {
        std::process::Command::new("hostname")
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    }
    #[cfg(not(unix))]
    {
        None
    }
}

#[tauri::command]
pub fn list_shells() -> Vec<ShellInfo> {
    crate::shell::list_shells()
}

#[tauri::command]
pub fn open_local_terminal(
    app: AppHandle,
    session_id: String,
    shell_id: Option<String>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
) -> Result<OpenLocalTerminalResult, String> {
    let shell = find_shell(shell_id.as_deref());
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;

    let mut command = CommandBuilder::new(&shell.path);
    for arg in &shell.args {
        command.arg(arg);
    }
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");

    // Start the shell in the requested working directory when it resolves;
    // an invalid path silently falls back to the shell default (home).
    // 请求的工作目录可解析时以该目录启动 shell；无效路径静默回退到默认
    //（home）目录，不阻断终端创建。
    if let Some(cwd) = cwd.as_deref()
        && let Ok(resolved) = crate::workspace::resolve_path(cwd)
        && resolved.is_dir()
    {
        command.cwd(resolved);
    }

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;

    let app_handle = app.clone();
    let read_session_id = session_id.clone();
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buffer = [0u8; 8192];
        let mut decoder = Utf8StreamDecoder::new();
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    let data = decoder.push(&buffer[..count]);
                    if data.is_empty() {
                        continue;
                    }
                    let _ = app_handle.emit(
                        "terminal:data",
                        TerminalDataEvent {
                            session_id: read_session_id.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
        let tail = decoder.finish();
        if !tail.is_empty() {
            let _ = app_handle.emit(
                "terminal:data",
                TerminalDataEvent {
                    session_id: read_session_id.clone(),
                    data: tail,
                },
            );
        }
        let _ = app_handle.emit(
            "terminal:exit",
            TerminalExitEvent {
                session_id: read_session_id.clone(),
                code: None,
            },
        );
        let _ = SessionManager::global().close_terminal(&read_session_id);
    });

    SessionManager::global()
        .insert_terminal(
            session_id.clone(),
            TerminalBackend::Local {
                master: pair.master,
                child,
                writer,
            },
            SessionKind::Local,
        )
        .map_err(|error| puck_err::<()>(error).unwrap_err())?;

    Ok(OpenLocalTerminalResult {
        session_id,
        shell,
    })
}

#[tauri::command]
pub fn write_terminal(session_id: String, data: String) -> Result<(), String> {
    SessionManager::global()
        .write_terminal(&session_id, &data)
        .map_err(|error| puck_err::<()>(error).unwrap_err())
}

#[tauri::command]
pub fn resize_terminal(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
    SessionManager::global()
        .resize_terminal(&session_id, cols, rows)
        .map_err(|error| puck_err::<()>(error).unwrap_err())
}

#[tauri::command]
pub fn close_session(app: AppHandle, session_id: String) -> Result<(), String> {
    cancel_ssh_open(&session_id);
    let manager = SessionManager::global();
    let terminal_profile = manager.ssh_profile(&session_id);
    let sftp_connection_lease = manager.sftp_connection_lease(&session_id);
    let closed_terminal = manager.close_terminal(&session_id);
    let closed_sftp = manager.close_sftp(&session_id).is_some();

    if let Some(profile) = terminal_profile {
        runtime().spawn(async move {
            release_shared_ssh(&profile.connection_id, &profile.lease_id).await;
        });
    }
    if let Some((connection_id, lease_id)) = sftp_connection_lease {
        runtime().spawn(async move {
            release_shared_ssh(&connection_id, &lease_id).await;
        });
    }

    if closed_terminal {
        let _ = app.emit(
            "terminal:exit",
            TerminalExitEvent {
                session_id: session_id.clone(),
                code: None,
            },
        );
    }

    if !closed_terminal && !closed_sftp {
        return Ok(());
    }

    Ok(())
}

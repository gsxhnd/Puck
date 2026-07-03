use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

use crate::error::{PuckError, PuckResult};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub index_status: String,
    pub worktree_status: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub staged: Vec<GitFileStatus>,
    pub unstaged: Vec<GitFileStatus>,
    pub untracked: Vec<String>,
}

fn resolve_path(path: &str) -> PuckResult<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(PuckError::config("Path is required"));
    }

    let expanded = if trimmed == "~" {
        dirs::home_dir().ok_or_else(|| PuckError::config("Home directory not found"))?
    } else if let Some(rest) = trimmed.strip_prefix("~/") {
        let home = dirs::home_dir().ok_or_else(|| PuckError::config("Home directory not found"))?;
        home.join(rest)
    } else {
        PathBuf::from(trimmed)
    };

    Ok(expanded)
}

fn list_local_dir_inner(path: &str, show_hidden: bool) -> PuckResult<Vec<LocalFileEntry>> {
    let resolved = resolve_path(path)?;
    if !resolved.is_dir() {
        return Err(PuckError::config("Path is not a directory"));
    }

    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&resolved).map_err(PuckError::from)? {
        let entry = entry.map_err(PuckError::from)?;
        let metadata = entry.metadata().map_err(PuckError::from)?;
        let name = entry.file_name().to_string_lossy().into_owned();

        if !show_hidden && name.starts_with('.') {
            continue;
        }

        let path = entry.path();
        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs());

        entries.push(LocalFileEntry {
            name,
            path: path.to_string_lossy().into_owned(),
            is_dir: metadata.is_dir(),
            size: if metadata.is_dir() { 0 } else { metadata.len() },
            modified,
        });
    }

    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(entries)
}

fn run_git(args: &[&str], cwd: &Path) -> PuckResult<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|error| PuckError::config(format!("Failed to run git: {error}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(PuckError::config(if stderr.is_empty() {
            "Git command failed".into()
        } else {
            stderr
        }));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn git_status_inner(path: &str) -> PuckResult<GitStatusResult> {
    let resolved = resolve_path(path)?;
    let cwd = if resolved.is_dir() {
        resolved
    } else {
        resolved
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| PuckError::config("Invalid path"))?
    };

    let is_repo = match run_git(&["rev-parse", "--is-inside-work-tree"], &cwd) {
        Ok(value) => value == "true",
        Err(_) => false,
    };

    if !is_repo {
        return Ok(GitStatusResult {
            is_repo: false,
            branch: None,
            staged: Vec::new(),
            unstaged: Vec::new(),
            untracked: Vec::new(),
        });
    }

    let branch = run_git(&["branch", "--show-current"], &cwd).ok();
    let porcelain = run_git(&["status", "--porcelain"], &cwd)?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for line in porcelain.lines() {
        if line.len() < 4 {
            continue;
        }

        let index_status = line.chars().next().unwrap_or(' ').to_string();
        let worktree_status = line.chars().nth(1).unwrap_or(' ').to_string();
        let file_path = parse_porcelain_path(&line[3..]);

        if index_status == "?" && worktree_status == "?" {
            untracked.push(file_path);
            continue;
        }

        let status = GitFileStatus {
            path: file_path,
            index_status: index_status.clone(),
            worktree_status: worktree_status.clone(),
        };

        if index_status != " " {
            staged.push(status.clone());
        }
        if worktree_status != " " {
            unstaged.push(status);
        }
    }

    Ok(GitStatusResult {
        is_repo: true,
        branch,
        staged,
        unstaged,
        untracked,
    })
}

fn to_invoke_error(error: PuckError) -> String {
    let payload = error.to_payload();
    serde_json::to_string(&payload).unwrap_or(payload.message)
}

#[tauri::command]
pub fn list_local_dir(path: String, show_hidden: Option<bool>) -> Result<Vec<LocalFileEntry>, String> {
    list_local_dir_inner(&path, show_hidden.unwrap_or(false)).map_err(to_invoke_error)
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatusResult, String> {
    git_status_inner(&path).map_err(to_invoke_error)
}

#[tauri::command]
pub fn open_path_in_app(path: String, app: String) -> Result<(), String> {
    open_path_in_app_inner(&path, &app).map_err(to_invoke_error)
}

const MAX_EDITOR_FILE_BYTES: u64 = 2 * 1024 * 1024;

fn read_local_file_inner(path: &str) -> PuckResult<String> {
    let resolved = resolve_path(path)?;
    if resolved.is_dir() {
        return Err(PuckError::config("Path is a directory"));
    }

    let metadata = std::fs::metadata(&resolved).map_err(PuckError::from)?;
    if metadata.len() > MAX_EDITOR_FILE_BYTES {
        return Err(PuckError::config("File is too large to edit"));
    }

    std::fs::read_to_string(&resolved).map_err(PuckError::from)
}

fn write_local_file_inner(path: &str, content: &str) -> PuckResult<()> {
    let resolved = resolve_path(path)?;
    if resolved.is_dir() {
        return Err(PuckError::config("Path is a directory"));
    }

    std::fs::write(&resolved, content.as_bytes()).map_err(PuckError::from)?;
    Ok(())
}

#[tauri::command]
pub fn read_local_file(path: String) -> Result<String, String> {
    read_local_file_inner(&path).map_err(to_invoke_error)
}

#[tauri::command]
pub fn write_local_file(path: String, content: String) -> Result<(), String> {
    write_local_file_inner(&path, &content).map_err(to_invoke_error)
}

fn parse_porcelain_path(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        return trimmed[1..trimmed.len() - 1]
            .replace("\\\"", "\"")
            .replace("\\\\", "\\");
    }

    if let Some((_, renamed_to)) = trimmed.split_once(" -> ") {
        return parse_porcelain_path(renamed_to);
    }

    trimmed.to_string()
}

fn open_path_in_app_inner(path: &str, app: &str) -> PuckResult<()> {
    let resolved = resolve_path(path)?;
    let target = if resolved.is_dir() {
        resolved.clone()
    } else {
        resolved
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| PuckError::config("Invalid path"))?
    };

    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        match app {
            "finder" => {
                command.arg("-R").arg(&resolved);
            }
            "terminal" => {
                command.args(["-a", "Terminal", &target.to_string_lossy()]);
            }
            "vscode" => {
                command.args(["-a", "Visual Studio Code", &target.to_string_lossy()]);
            }
            "cursor" => {
                command.args(["-a", "Cursor", &target.to_string_lossy()]);
            }
            "xcode" => {
                command.args(["-a", "Xcode", &target.to_string_lossy()]);
            }
            "zed" => {
                command.args(["-a", "Zed", &target.to_string_lossy()]);
            }
            _ => return Err(PuckError::config("Unknown application")),
        }

        command
            .spawn()
            .map_err(|error| PuckError::config(format!("Failed to open application: {error}")))?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        open_path_in_app_other(&resolved, &target, app)?;
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn open_path_in_app_other(resolved: &Path, target: &Path, app: &str) -> PuckResult<()> {
    let target_str = target.to_string_lossy();
    let resolved_str = resolved.to_string_lossy();

    #[cfg(target_os = "windows")]
    {
        let mut command = match app {
            "finder" => {
                let mut cmd = Command::new("explorer");
                cmd.arg(format!("/select,{resolved_str}"));
                cmd
            }
            "terminal" => {
                let mut cmd = Command::new("cmd");
                cmd.args(["/C", "start", "", "wt.exe", "-d", &target_str]);
                cmd
            }
            "vscode" => Command::new("code").arg(&target_str),
            "cursor" => Command::new("cursor").arg(&target_str),
            "zed" => Command::new("zed").arg(&target_str),
            _ => return Err(PuckError::config("Unknown application")),
        };
        command
            .spawn()
            .map_err(|error| PuckError::config(format!("Failed to open application: {error}")))?;
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut command = match app {
            "finder" => Command::new("xdg-open").arg(target),
            "terminal" => {
                if Command::new("x-terminal-emulator").arg("--version").output().is_ok() {
                    Command::new("x-terminal-emulator").arg("--working-directory").arg(target)
                } else {
                    Command::new("gnome-terminal").arg("--working-directory").arg(target)
                }
            }
            "vscode" => Command::new("code").arg(target),
            "cursor" => Command::new("cursor").arg(target),
            "zed" => Command::new("zed").arg(target),
            _ => return Err(PuckError::config("Unknown application")),
        };
        command
            .spawn()
            .map_err(|error| PuckError::config(format!("Failed to open application: {error}")))?;
    }

    Ok(())
}

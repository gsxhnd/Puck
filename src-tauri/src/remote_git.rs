//! Git commands executed on a remote workspace over the shared SSH connection.
//!
//! 远程工作区 Git 命令层。所有参数分别进行 POSIX shell 引用，禁用交互式凭据
//! 提示，并复用本地 Git 的 NUL/US/RS 解析器；不经过前端拼接 shell 命令。

use crate::error::{PuckError, PuckResult};
use crate::git::{
    classify_network_error, parse_branches, parse_graph_log, parse_log, parse_status_v2,
    GitBranchEntry, GitCommitEntry, GitGraphCommit, GitNetworkResult, GitStatusResult,
};
use crate::ssh::exec_remote_command_on_connection;

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn remote_path(path: &str) -> PuckResult<String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(PuckError::config("Path is required"));
    }
    if trimmed == "~" {
        return Ok("\"$HOME\"".into());
    }
    if let Some(rest) = trimmed.strip_prefix("~/") {
        return Ok(format!("\"$HOME\"/{}", shell_quote(rest)));
    }
    Ok(shell_quote(trimmed))
}

async fn run_git(connection_id: &str, path: &str, args: &[&str]) -> PuckResult<String> {
    if connection_id.trim().is_empty() {
        return Err(PuckError::config("SSH connection id is required"));
    }
    let mut command = format!("GIT_TERMINAL_PROMPT=0 git -C {}", remote_path(path)?);
    for argument in args {
        command.push(' ');
        command.push_str(&shell_quote(argument));
    }
    exec_remote_command_on_connection(connection_id, &command)
        .await
        .map_err(PuckError::config)
}

async fn run_git_trimmed(
    connection_id: &str,
    path: &str,
    args: &[&str],
) -> PuckResult<String> {
    let output = run_git(connection_id, path, args).await?;
    Ok(output.trim_end_matches('\0').trim().to_string())
}

fn to_invoke_error(error: PuckError) -> String {
    let payload = error.into_payload();
    serde_json::to_string(&payload).unwrap_or(payload.message)
}

#[tauri::command]
pub async fn remote_git_status(
    connection_id: String,
    path: String,
) -> Result<GitStatusResult, String> {
    let result = async {
        let is_repo = matches!(
            run_git_trimmed(
                &connection_id,
                &path,
                &["rev-parse", "--is-inside-work-tree"],
            )
            .await,
            Ok(value) if value == "true"
        );
        if !is_repo {
            return Ok(GitStatusResult::default());
        }
        let output = run_git_trimmed(
            &connection_id,
            &path,
            &["status", "--porcelain=v2", "-z", "--branch"],
        )
        .await?;
        Ok(parse_status_v2(&output))
    }
    .await;
    result.map_err(to_invoke_error)
}

#[tauri::command]
pub async fn remote_git_blob_content(
    connection_id: String,
    path: String,
    file: String,
    revision: String,
) -> Result<Option<String>, String> {
    let spec = if revision == "head" {
        format!("HEAD:{file}")
    } else {
        format!(":{file}")
    };
    match run_git(&connection_id, &path, &["show", &spec]).await {
        Ok(content) => Ok(Some(content)),
        Err(_) => Ok(None),
    }
}

async fn run_files(
    connection_id: String,
    path: String,
    files: Vec<String>,
    action: &[&str],
) -> Result<(), String> {
    let result = async {
        let mut args = action.to_vec();
        args.extend(files.iter().map(String::as_str));
        run_git(&connection_id, &path, &args).await?;
        Ok(())
    }
    .await;
    result.map_err(to_invoke_error)
}

#[tauri::command]
pub async fn remote_git_stage(
    connection_id: String,
    path: String,
    files: Vec<String>,
) -> Result<(), String> {
    run_files(connection_id, path, files, &["add", "--"]).await
}

#[tauri::command]
pub async fn remote_git_unstage(
    connection_id: String,
    path: String,
    files: Vec<String>,
) -> Result<(), String> {
    run_files(connection_id, path, files, &["reset", "-q", "HEAD", "--"]).await
}

#[tauri::command]
pub async fn remote_git_discard(
    connection_id: String,
    path: String,
    files: Vec<String>,
) -> Result<(), String> {
    run_files(connection_id, path, files, &["restore", "--worktree", "--"]).await
}

#[tauri::command]
pub async fn remote_git_commit(
    connection_id: String,
    path: String,
    message: String,
) -> Result<(), String> {
    let result = async {
        let trimmed = message.trim();
        if trimmed.is_empty() {
            return Err(PuckError::config("Commit message is required"));
        }
        run_git(&connection_id, &path, &["commit", "-m", trimmed]).await?;
        Ok(())
    }
    .await;
    result.map_err(to_invoke_error)
}

#[tauri::command]
pub async fn remote_git_log(
    connection_id: String,
    path: String,
    limit: Option<u32>,
) -> Result<Vec<GitCommitEntry>, String> {
    let result = async {
        let limit = limit.unwrap_or(20).max(1).to_string();
        let output = run_git_trimmed(
            &connection_id,
            &path,
            &[
                "log",
                "--max-count",
                &limit,
                "--date=iso-local",
                "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1e",
            ],
        )
        .await?;
        Ok(parse_log(&output))
    }
    .await;
    result.map_err(to_invoke_error)
}

#[tauri::command]
pub async fn remote_git_graph(
    connection_id: String,
    path: String,
    limit: Option<u32>,
    skip: Option<u32>,
) -> Result<Vec<GitGraphCommit>, String> {
    let result = async {
        let limit = limit.unwrap_or(200).clamp(1, 500).to_string();
        let skip = skip.unwrap_or(0).to_string();
        let output = run_git_trimmed(
            &connection_id,
            &path,
            &[
                "log",
                "--all",
                "--topo-order",
                "--max-count",
                &limit,
                "--skip",
                &skip,
                "--date=iso-local",
                "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1f%P%x1f%D%x1e",
            ],
        )
        .await?;
        Ok(parse_graph_log(&output))
    }
    .await;
    result.map_err(to_invoke_error)
}

#[tauri::command]
pub async fn remote_git_branches(
    connection_id: String,
    path: String,
) -> Result<Vec<GitBranchEntry>, String> {
    let result = async {
        let output = run_git_trimmed(
            &connection_id,
            &path,
            &[
                "branch",
                "--list",
                "--format=%(refname:short)%00%(HEAD)%00%(objectname:short)",
            ],
        )
        .await?;
        Ok(parse_branches(&output))
    }
    .await;
    result.map_err(to_invoke_error)
}

#[tauri::command]
pub async fn remote_git_checkout(
    connection_id: String,
    path: String,
    branch: String,
) -> Result<(), String> {
    let result = async {
        let trimmed = branch.trim();
        if trimmed.is_empty() {
            return Err(PuckError::config("Branch name is required"));
        }
        run_git(&connection_id, &path, &["checkout", trimmed]).await?;
        Ok(())
    }
    .await;
    result.map_err(to_invoke_error)
}

async fn network(
    connection_id: &str,
    path: &str,
    args: &[&str],
) -> PuckResult<GitNetworkResult> {
    match run_git_trimmed(connection_id, path, args).await {
        Ok(_) => Ok(GitNetworkResult {
            ok: true,
            error_kind: None,
            message: None,
        }),
        Err(error) => {
            let payload = error.clone().into_payload();
            match classify_network_error(&payload.message) {
                Some(kind) => Ok(GitNetworkResult {
                    ok: false,
                    error_kind: Some(kind.to_string()),
                    message: Some(payload.message),
                }),
                None => Err(error),
            }
        }
    }
}

fn network_result(result: PuckResult<GitNetworkResult>) -> Result<GitNetworkResult, String> {
    result.map_err(to_invoke_error)
}

#[tauri::command]
pub async fn remote_git_fetch(
    connection_id: String,
    path: String,
) -> Result<GitNetworkResult, String> {
    network_result(network(&connection_id, &path, &["fetch", "--all", "--prune"]).await)
}

#[tauri::command]
pub async fn remote_git_pull(
    connection_id: String,
    path: String,
) -> Result<GitNetworkResult, String> {
    network_result(network(&connection_id, &path, &["pull", "--ff-only"]).await)
}

#[tauri::command]
pub async fn remote_git_push(
    connection_id: String,
    path: String,
) -> Result<GitNetworkResult, String> {
    let result = async {
        let branch = run_git_trimmed(&connection_id, &path, &["branch", "--show-current"]).await?;
        let mut args = vec!["push"];
        if !branch.is_empty()
            && run_git_trimmed(
                &connection_id,
                &path,
                &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
            )
            .await
            .is_err()
        {
            args.extend(["--set-upstream", "origin", &branch]);
        }
        network(&connection_id, &path, &args).await
    }
    .await;
    network_result(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_arguments_are_quoted() {
        assert_eq!(shell_quote("a'b c"), "'a'\\''b c'");
    }

    #[test]
    fn home_relative_paths_keep_home_expansion() {
        assert_eq!(remote_path("~").unwrap(), "\"$HOME\"");
        assert_eq!(remote_path("~/work/a b").unwrap(), "\"$HOME\"/'work/a b'");
        assert_eq!(remote_path("/srv/a b").unwrap(), "'/srv/a b'");
    }
}

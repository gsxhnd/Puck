//! Async Git command layer for local workspaces.
//!
//! 本地工作区的异步 Git 命令层。所有 Git 调用使用参数数组（不经 shell 拼接）、
//! 禁用终端密码提示（`GIT_TERMINAL_PROMPT=0`，认证失败返回可理解错误而不是
//! 卡死），并通过 tokio 异步执行避免阻塞 Tauri 主线程。状态输出使用
//! `status --porcelain-v2 -z` 稳定格式；解析函数为纯函数并带单元测试，
//! 正确处理空格、中文与 rename 路径（`-z` 模式下路径不转义、原样输出）。

use std::path::{Path, PathBuf};

use serde::Serialize;
use tokio::process::Command;

use crate::error::{PuckError, PuckResult};
use crate::workspace::resolve_path;

/// One changed file entry as reported by `git status`.
///
/// 一条来自 `git status` 的文件变更记录。`index_status` / `worktree_status`
/// 为 porcelain-v2 的 X/Y 列（`.` 表示无变更）；rename 时额外携带原始路径。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub index_status: String,
    pub worktree_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub orig_path: Option<String>,
}

/// One entry of the simplified commit history.
///
/// 一条简洁提交历史记录：完整与短哈希、作者、ISO 日期和单行主题。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitEntry {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub date: String,
    pub subject: String,
}

/// One local branch entry.
///
/// 一条本地分支记录：名称、短哈希与是否为当前检出分支。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchEntry {
    pub name: String,
    pub short_hash: String,
    pub is_current: bool,
}

/// Structured result of a git network operation (fetch/pull/push).
///
/// git 网络操作（fetch/pull/push）的结构化结果。认证或网络失败是常见且可
/// 恢复的情况，因此以 `ok: false` + `error_kind` 返回而不是命令错误，便于
/// 前端提供「在终端中重试」等后续动作；`error_kind` 取值：`auth`、
/// `no_upstream`、`network`。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitNetworkResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Aggregated status for a local Git workspace.
///
/// 本地 Git 工作区的聚合状态。`is_repo` 为 false 时其余字段全部为空；
/// branch 为 `None` 表示 detached HEAD 或无 upstream 信息。
#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
    pub staged: Vec<GitFileStatus>,
    pub unstaged: Vec<GitFileStatus>,
    pub untracked: Vec<String>,
}

/// Runs git with argument-array quoting and non-interactive prompts disabled.
///
/// 以参数数组方式执行 git（无 shell 注入面），禁用终端凭据提示；失败时返回
/// 带 stderr 的错误。返回**原始 stdout**（不修整）——blob 内容的尾部换行是
/// 文件内容的一部分，不能剥除；列表类输出请使用 [`run_git_trimmed`]。
async fn run_git(args: &[&str], cwd: &Path) -> PuckResult<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .await
        .map_err(|error| PuckError::config(format!("Failed to run git: {error}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(PuckError::config(if stderr.is_empty() {
            "Git command failed".into()
        } else {
            stderr
        }));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Runs git, stripping trailing NUL separators and surrounding whitespace.
///
/// 执行 git 并剥除尾部 NUL 分隔符与首尾空白，适用于 `status`、`rev-parse`
/// 等列表/标量输出；blob 内容必须使用 [`run_git`]。
async fn run_git_trimmed(args: &[&str], cwd: &Path) -> PuckResult<String> {
    let stdout = run_git(args, cwd).await?;
    Ok(stdout.trim_end_matches('\0').trim().to_string())
}

/// Parses `git status --porcelain-v2 -z --branch` output.
///
/// 解析 porcelain-v2 NUL 分隔输出：`#` 头部行、`?` untracked、`!` ignored
///（忽略不展示）、`1` 普通变更、`2` rename（原始路径是紧随其后的独立 NUL
/// 段）。路径列使用 `splitn(9)` 以保留其中的空格。
pub fn parse_status_v2(output: &str) -> GitStatusResult {
    let mut result = GitStatusResult::default();

    let records: Vec<&str> = output.split('\0').filter(|s| !s.is_empty()).collect();
    let mut index = 0;
    while index < records.len() {
        let record = records[index];
        index += 1;

        if let Some(rest) = record.strip_prefix("# ") {
            parse_branch_header(&mut result, rest);
            continue;
        }

        if let Some(path) = record.strip_prefix("? ") {
            if !path.is_empty() {
                result.untracked.push(path.to_string());
            }
            continue;
        }

        if record.starts_with("! ") {
            // Ignored files are intentionally not surfaced. 忽略 ignored 文件。
            continue;
        }

        if record.starts_with("1 ") || record.starts_with("2 ") {
            let Some((xy, path)) = split_status_record(record) else {
                continue;
            };
            if record.starts_with("2 ") {
                // The original path of a rename is the next NUL-separated
                // record.
                // rename 的原始路径是紧随其后的下一个 NUL 分隔段。
                let orig_path = records.get(index).map(|s| s.to_string());
                if records.get(index).is_some() {
                    index += 1;
                }
                apply_status_columns(&mut result, xy, path, orig_path);
            } else {
                apply_status_columns(&mut result, xy, path, None);
            }
            continue;
        }
    }

    result.is_repo = true;
    result
}

/// Splits a `1`/`2` status record into (XY, path).
///
/// 把 `1`/`2` 状态记录拆出 (XY, path)。路径是最后一列且可能包含空格，因此
/// 使用 `splitn` 保证最后一段保留完整路径：`1` 记录共 9 列（路径前为 sub、
/// mH、mI、mW、hH、hI），`2` 记录多一个 `<X><score>` rename 分数列共 10 列。
fn split_status_record(record: &str) -> Option<(&str, &str)> {
    let rename = record.starts_with("2 ");
    let limit = if rename { 10 } else { 9 };
    let mut parts = record.splitn(limit, ' ');
    let tag = parts.next()?;
    if tag != "1" && tag != "2" {
        return None;
    }
    let xy = parts.next()?;
    // Skip the fixed columns between XY and the path; `2` records add the
    // rename score column.
    // 跳过 XY 与路径列之间的固定列；`2` 记录额外多一个 rename 分数列。
    let skip = if rename { 7 } else { 6 };
    for _ in 0..skip {
        parts.next()?;
    }
    let path = parts.next()?;
    Some((xy, path))
}

/// Parses `# branch.*` header lines into the result.
/// 解析 `# branch.*` 头部行；detached HEAD 时不设置 branch。
fn parse_branch_header(result: &mut GitStatusResult, rest: &str) {
    if let Some(head) = rest.strip_prefix("branch.head ") {
        if head != "(detached)" {
            result.branch = Some(head.to_string());
        }
        return;
    }
    if let Some(upstream) = rest.strip_prefix("branch.upstream ") {
        result.upstream = Some(upstream.to_string());
        return;
    }
    if let Some(ab) = rest.strip_prefix("branch.ab ") {
        let mut parts = ab.split(' ');
        let ahead = parts
            .next()
            .and_then(|value| value.strip_prefix('+'))
            .and_then(|value| value.parse().ok());
        let behind = parts
            .next()
            .and_then(|value| value.strip_prefix('-'))
            .and_then(|value| value.parse().ok());
        result.ahead = ahead;
        result.behind = behind;
    }
}

/// Splits porcelain-v2 X/Y columns into staged / unstaged entries.
/// 按 X/Y 列把记录拆入 staged / unstaged；`.` 表示无变更，`?` 为防御性处理。
fn apply_status_columns(
    result: &mut GitStatusResult,
    xy: &str,
    path: &str,
    orig_path: Option<String>,
) {
    let mut columns = xy.chars();
    let x = columns.next().unwrap_or('.');
    let y = columns.next().unwrap_or('.');

    let status = GitFileStatus {
        path: path.to_string(),
        index_status: x.to_string(),
        worktree_status: y.to_string(),
        orig_path,
    };

    if x != '.' && x != '?' {
        result.staged.push(status.clone());
    }
    if y != '.' && y != '?' {
        result.unstaged.push(status);
    }
}

async fn git_status_inner(path: &str) -> PuckResult<GitStatusResult> {
    let cwd = workspace_dir(path).await?;

    let is_repo = match run_git_trimmed(&["rev-parse", "--is-inside-work-tree"], &cwd).await {
        Ok(value) => value == "true",
        Err(_) => false,
    };
    if !is_repo {
        return Ok(GitStatusResult {
            is_repo: false,
            ..Default::default()
        });
    }

    let output = run_git_trimmed(
        // Note: git requires `--porcelain=v2` with an equals sign; the
        // hyphenated form is rejected.
        // 注意：git 只接受等号形式 `--porcelain=v2`，连字符写法会报错。
        &["status", "--porcelain=v2", "-z", "--branch"],
        &cwd,
    )
    .await?;
    let mut result = parse_status_v2(&output);
    result.is_repo = true;
    Ok(result)
}

/// Resolves the workspace directory for git commands (the directory itself
/// for directories, or the parent for files).
///
/// 解析 git 命令的工作目录：目录直接使用，文件取其父目录。
async fn workspace_dir(path: &str) -> PuckResult<PathBuf> {
    let resolved = resolve_path(path)?;
    if resolved.is_dir() {
        Ok(resolved)
    } else {
        resolved
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| PuckError::config("Invalid path"))
    }
}

fn to_invoke_error(error: PuckError) -> String {
    let payload = error.to_payload();
    serde_json::to_string(&payload).unwrap_or(payload.message)
}

#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatusResult, String> {
    git_status_inner(&path).await.map_err(to_invoke_error)
}

/// Returns the blob content of a file from the index or HEAD.
///
/// 读取文件在 index（暂存版本）或 HEAD（上次提交版本）中的 blob 内容，用于
/// 构建 Diff 视图的 original/modified 两份文本。该版本中不存在该文件（新文件
/// 尚未 add / 首次提交前）时返回 None。
async fn git_blob_content_inner(
    path: &str,
    file: &str,
    revision: &str,
) -> PuckResult<Option<String>> {
    let cwd = workspace_dir(path).await?;
    // `file` is workspace-relative as reported by status; the revision spec is
    // passed as a single argument (argument array, no shell interpolation).
    // `file` 是 status 返回的工作区相对路径；revision 规格作为单个参数传递。
    let spec = match revision {
        "head" => format!("HEAD:{file}"),
        _ => format!(":{file}"),
    };
    match run_git(&["show", &spec], &cwd).await {
        Ok(content) => Ok(Some(content)),
        // A missing blob is an expected condition (new/deleted file), so any
        // failure to resolve the revision maps to None.
        // blob 不存在是正常情况（新增/删除文件），因此统一映射为 None。
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn git_blob_content(
    path: String,
    file: String,
    revision: String,
) -> Result<Option<String>, String> {
    git_blob_content_inner(&path, &file, &revision)
        .await
        .map_err(to_invoke_error)
}

async fn git_stage_inner(path: &str, files: &[String]) -> PuckResult<()> {
    let cwd = workspace_dir(path).await?;
    let mut args: Vec<&str> = vec!["add", "--"];
    args.extend(files.iter().map(String::as_str));
    run_git(&args, &cwd).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    git_stage_inner(&path, &files).await.map_err(to_invoke_error)
}

async fn git_unstage_inner(path: &str, files: &[String]) -> PuckResult<()> {
    let cwd = workspace_dir(path).await?;
    let mut args: Vec<&str> = vec!["reset", "-q", "HEAD", "--"];
    args.extend(files.iter().map(String::as_str));
    run_git(&args, &cwd).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    git_unstage_inner(&path, &files)
        .await
        .map_err(to_invoke_error)
}

async fn git_discard_inner(path: &str, files: &[String]) -> PuckResult<()> {
    let cwd = workspace_dir(path).await?;
    // Only tracked worktree modifications are restorable; untracked files and
    // unmerged entries are rejected by git itself.
    // restore 仅作用于已跟踪文件的工作区修改；untracked 与 unmerged 条目由
    // git 自身拒绝并透出错误。
    let mut args: Vec<&str> = vec!["restore", "--worktree", "--"];
    args.extend(files.iter().map(String::as_str));
    run_git(&args, &cwd).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_discard(path: String, files: Vec<String>) -> Result<(), String> {
    git_discard_inner(&path, &files)
        .await
        .map_err(to_invoke_error)
}

async fn git_commit_inner(path: &str, message: &str) -> PuckResult<()> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err(PuckError::config("Commit message is required"));
    }
    let cwd = workspace_dir(path).await?;
    run_git(&["commit", "-m", trimmed], &cwd).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<(), String> {
    git_commit_inner(&path, &message)
        .await
        .map_err(to_invoke_error)
}

/// Parses `git log --pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1e` output.
///
/// 解析提交历史输出：记录以 `\u{1e}` 分隔、字段以 `\u{1f}` 分隔，避免提交
/// 主题中的 `|` 等常见字符破坏解析。解析为纯函数并带单元测试。
pub fn parse_log(output: &str) -> Vec<GitCommitEntry> {
    output
        .split('\u{1e}')
        .filter(|record| !record.trim().is_empty())
        .map(|record| {
            let mut fields = record.split('\u{1f}');
            GitCommitEntry {
                hash: fields.next().unwrap_or("").trim().to_string(),
                short_hash: fields.next().unwrap_or("").trim().to_string(),
                author: fields.next().unwrap_or("").trim().to_string(),
                date: fields.next().unwrap_or("").trim().to_string(),
                // The subject is the final field; drop any trailing newline
                // that the log format may append before the record separator.
                // 主题是最后一个字段；剥除记录分隔符之前可能出现的尾换行。
                subject: fields
                    .next()
                    .unwrap_or("")
                    .trim_end()
                    .to_string(),
            }
        })
        .collect()
}

/// Reads a simplified local commit history.
///
/// 读取本地仓库的简洁提交历史。默认 20 条；输出为单元分隔格式
///（`\u{1f}` 字段 / `\u{1e}` 记录），经 [`parse_log`] 解析。
async fn git_log_inner(path: &str, limit: u32) -> PuckResult<Vec<GitCommitEntry>> {
    let cwd = workspace_dir(path).await?;
    let limit_string = limit.max(1).to_string();
    let output = run_git_trimmed(
        &[
            "log",
            "--max-count",
            &limit_string,
            "--date=iso-local",
            "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1e",
        ],
        &cwd,
    )
    .await?;
    Ok(parse_log(&output))
}

#[tauri::command]
pub async fn git_log(
    path: String,
    limit: Option<u32>,
) -> Result<Vec<GitCommitEntry>, String> {
    git_log_inner(&path, limit.unwrap_or(20))
        .await
        .map_err(to_invoke_error)
}

/// Parses `git branch --format=%(refname:short)%00%(HEAD)%00%(objectname:short)`
/// output.
///
/// 解析分支列表输出：记录按行分隔、字段按 NUL 分隔（分支名可含空格但不能含
/// 换行），`%(HEAD)` 列为 `*` 时表示当前检出分支。解析为纯函数并带单元测试。
pub fn parse_branches(output: &str) -> Vec<GitBranchEntry> {
    output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let mut fields = line.split('\0');
            GitBranchEntry {
                name: fields.next().unwrap_or("").trim().to_string(),
                is_current: fields.next().unwrap_or("").trim() == "*",
                short_hash: fields.next().unwrap_or("").trim().to_string(),
            }
        })
        .collect()
}

/// Lists local branches with the current one marked.
///
/// 列出本地分支并标记当前检出分支。
async fn git_branches_inner(path: &str) -> PuckResult<Vec<GitBranchEntry>> {
    let cwd = workspace_dir(path).await?;
    let output = run_git_trimmed(
        &[
            "branch",
            "--list",
            "--format=%(refname:short)%00%(HEAD)%00%(objectname:short)",
        ],
        &cwd,
    )
    .await?;
    Ok(parse_branches(&output))
}

#[tauri::command]
pub async fn git_branches(path: String) -> Result<Vec<GitBranchEntry>, String> {
    git_branches_inner(&path).await.map_err(to_invoke_error)
}

/// Checks out a branch. Git itself refuses when the worktree has conflicting
/// changes, and the error is surfaced to the frontend.
///
/// 切换分支。工作区存在冲突修改时 git 自身会拒绝并透出错误；分支名经参数
/// 数组传递，无 shell 注入面。
async fn git_checkout_inner(path: &str, branch: &str) -> PuckResult<()> {
    let trimmed = branch.trim();
    if trimmed.is_empty() {
        return Err(PuckError::config("Branch name is required"));
    }
    let cwd = workspace_dir(path).await?;
    run_git_trimmed(&["checkout", trimmed], &cwd).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_checkout(path: String, branch: String) -> Result<(), String> {
    git_checkout_inner(&path, &branch)
        .await
        .map_err(to_invoke_error)
}

/// Classifies a git failure message into an actionable error kind.
///
/// 把 git 失败信息分类为可操作的错误类别：认证失败、缺少 upstream、网络/
/// 远端不可达，其余返回 None（按普通命令错误处理）。匹配项均来自 git 真实
/// 输出，小写比较；解析为纯函数并带单元测试。
pub fn classify_network_error(message: &str) -> Option<&'static str> {
    let lowered = message.to_lowercase();

    if lowered.contains("authentication failed")
        || lowered.contains("could not read username")
        || lowered.contains("terminal prompts disabled")
        || lowered.contains("permission denied")
        || lowered.contains("invalid credentials")
        || lowered.contains("403")
    {
        return Some("auth");
    }

    if lowered.contains("no upstream")
        || lowered.contains("does not have an upstream")
        || lowered.contains("set upstream")
    {
        return Some("no_upstream");
    }

    if lowered.contains("could not resolve host")
        || lowered.contains("connection refused")
        || lowered.contains("connection timed out")
        || lowered.contains("failed to connect")
        || lowered.contains("timed out")
        || lowered.contains("does not appear to be a git repository")
    {
        return Some("network");
    }

    None
}

/// Runs a git network command and maps expected failures to a structured
/// result instead of a command error.
///
/// 执行 git 网络命令；认证/网络类失败映射为结构化结果（`ok: false`）而非
/// 命令错误，其余失败（如非仓库目录）仍按错误返回。
async fn git_network_inner(
    cwd: &Path,
    args: &[&str],
) -> PuckResult<GitNetworkResult> {
    match run_git_trimmed(args, cwd).await {
        Ok(_) => Ok(GitNetworkResult {
            ok: true,
            error_kind: None,
            message: None,
        }),
        Err(error) => {
            // to_payload consumes the error, so clone first and keep the
            // original for the non-network rethrow path.
            // to_payload 会消耗 error，先 clone 保留原值供非网络错误重新抛出。
            let payload = error.clone().to_payload();
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

/// Fetches all remotes with pruning.
///
/// 拉取全部远端并清理已删除的远端引用。
async fn git_fetch_inner(path: &str) -> PuckResult<GitNetworkResult> {
    let cwd = workspace_dir(path).await?;
    git_network_inner(&cwd, &["fetch", "--all", "--prune"]).await
}

#[tauri::command]
pub async fn git_fetch(path: String) -> Result<GitNetworkResult, String> {
    git_fetch_inner(&path).await.map_err(to_invoke_error)
}

/// Fast-forward only pull; diverged branches are rejected by git itself so
/// the worktree is never silently merged or rebased.
///
/// 仅快进拉取；分叉时 git 自身拒绝合并，绝不静默改写工作区。
async fn git_pull_inner(path: &str) -> PuckResult<GitNetworkResult> {
    let cwd = workspace_dir(path).await?;
    git_network_inner(&cwd, &["pull", "--ff-only"]).await
}

#[tauri::command]
pub async fn git_pull(path: String) -> Result<GitNetworkResult, String> {
    git_pull_inner(&path).await.map_err(to_invoke_error)
}

/// Pushes the current branch; publishes with `--set-upstream origin <branch>`
/// when no upstream is configured yet.
///
/// 推送当前分支；尚未配置 upstream 时自动以 `--set-upstream origin <branch>`
/// 发布当前分支（远端名固定为 origin，未配置 origin 时 git 报错透出）。
async fn git_push_inner(path: &str) -> PuckResult<GitNetworkResult> {
    let cwd = workspace_dir(path).await?;
    let branch = run_git_trimmed(&["branch", "--show-current"], &cwd).await?;

    let mut args: Vec<&str> = vec!["push"];
    if !branch.is_empty()
        && run_git_trimmed(
            &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
            &cwd,
        )
        .await
        .is_err()
    {
        args.push("--set-upstream");
        args.push("origin");
        args.push(&branch);
    }

    git_network_inner(&cwd, &args).await
}

#[tauri::command]
pub async fn git_push(path: String) -> Result<GitNetworkResult, String> {
    git_push_inner(&path).await.map_err(to_invoke_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_output_is_clean_repo() {
        let result = parse_status_v2("");
        assert!(result.is_repo);
        assert!(result.staged.is_empty());
        assert!(result.unstaged.is_empty());
        assert!(result.untracked.is_empty());
        assert_eq!(result.branch, None);
    }

    #[test]
    fn untracked_files_are_collected() {
        let result = parse_status_v2("? src/main.rs\0? 未跟踪 目录/文件.txt\0");
        assert_eq!(result.untracked.len(), 2);
        assert_eq!(result.untracked[0], "src/main.rs");
        assert_eq!(result.untracked[1], "未跟踪 目录/文件.txt");
        assert!(result.staged.is_empty());
        assert!(result.unstaged.is_empty());
    }

    #[test]
    fn worktree_only_change_is_unstaged() {
        let result = parse_status_v2("1 .M N... 100644 100644 100644 hHHH hIII src/lib.rs\0");
        assert_eq!(result.unstaged.len(), 1);
        assert_eq!(result.unstaged[0].path, "src/lib.rs");
        assert_eq!(result.unstaged[0].index_status, ".");
        assert_eq!(result.unstaged[0].worktree_status, "M");
        assert!(result.staged.is_empty());
    }

    #[test]
    fn index_only_change_is_staged() {
        let result = parse_status_v2(
            "1 D. N... 100644 000000 100644 hHHH hIII old name with spaces.txt\0",
        );
        assert_eq!(result.staged.len(), 1);
        assert_eq!(result.staged[0].path, "old name with spaces.txt");
        assert_eq!(result.staged[0].index_status, "D");
        assert!(result.unstaged.is_empty());
    }

    #[test]
    fn both_columns_report_both_lists() {
        let result =
            parse_status_v2("1 MM N... 100644 100644 100644 hHHH hIII src/main.rs\0");
        assert_eq!(result.staged.len(), 1);
        assert_eq!(result.unstaged.len(), 1);
        assert_eq!(result.staged[0].path, "src/main.rs");
        assert_eq!(result.unstaged[0].path, "src/main.rs");
    }

    #[test]
    fn rename_record_keeps_original_path() {
        let result = parse_status_v2(
            "2 R. N... 100644 100644 100644 hHHH hIII R100 新名字.md\0旧名字 with space.md\0",
        );
        assert_eq!(result.staged.len(), 1);
        assert_eq!(result.staged[0].path, "新名字.md");
        assert_eq!(
            result.staged[0].orig_path.as_deref(),
            Some("旧名字 with space.md")
        );
        assert!(result.unstaged.is_empty());
    }

    #[test]
    fn unmerged_entries_appear_in_both_lists() {
        let result = parse_status_v2(
            "1 UU N... 100644 100644 100644 hHHH hIII conflicted file.rs\0",
        );
        assert_eq!(result.staged.len(), 1);
        assert_eq!(result.staged[0].index_status, "U");
        assert_eq!(result.unstaged.len(), 1);
        assert_eq!(result.unstaged[0].worktree_status, "U");
    }

    #[test]
    fn log_records_are_parsed() {
        let output = "abc123\u{1f}abc\u{1f}Alice\u{1f}2026-11-18 10:00:00 +0800\u{1f}first commit\u{1e}def456\u{1f}def\u{1f}鲍勃\u{1f}2026-11-18 11:00:00 +0800\u{1f}第二条 | 带竖线 主题\u{1e}";
        let entries = parse_log(output);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].hash, "abc123");
        assert_eq!(entries[0].short_hash, "abc");
        assert_eq!(entries[0].author, "Alice");
        assert_eq!(entries[0].subject, "first commit");
        assert_eq!(entries[1].hash, "def456");
        assert_eq!(entries[1].author, "鲍勃");
        assert_eq!(entries[1].subject, "第二条 | 带竖线 主题");
    }

    #[test]
    fn empty_log_parses_to_empty_list() {
        assert!(parse_log("").is_empty());
    }

    #[test]
    fn branch_records_are_parsed() {
        let output = "main\0*\0abc123\nfeature/带空格 分支\0 \0def456\n";
        let branches = parse_branches(output);
        assert_eq!(branches.len(), 2);
        assert_eq!(branches[0].name, "main");
        assert!(branches[0].is_current);
        assert_eq!(branches[0].short_hash, "abc123");
        assert_eq!(branches[1].name, "feature/带空格 分支");
        assert!(!branches[1].is_current);
        assert_eq!(branches[1].short_hash, "def456");
    }

    #[test]
    fn empty_branch_list_parses_to_empty_vec() {
        assert!(parse_branches("").is_empty());
    }

    #[test]
    fn branch_headers_are_parsed() {
        let result = parse_status_v2(
            "# branch.head main\0# branch.upstream origin/main\0# branch.ab +3 -7\0",
        );
        assert_eq!(result.branch.as_deref(), Some("main"));
        assert_eq!(result.upstream.as_deref(), Some("origin/main"));
        assert_eq!(result.ahead, Some(3));
        assert_eq!(result.behind, Some(7));
    }

    #[test]
    fn detached_head_has_no_branch() {
        let result = parse_status_v2("# branch.head (detached)\0");
        assert_eq!(result.branch, None);
        assert!(result.is_repo);
    }

    #[test]
    fn ignored_files_are_not_surfaced() {
        let result = parse_status_v2("! build/output.bin\0? keep.rs\0");
        assert!(result.staged.is_empty());
        assert!(result.unstaged.is_empty());
        assert_eq!(result.untracked, vec!["keep.rs"]);
    }

    /// End-to-end check against a real git repository in a temp directory.
    /// 针对真实 git 仓库的端到端检查：临时目录建仓、写入变更后执行
    /// `run_git` 并解析输出，验证选项写法与解析逻辑对真实输出有效。
    #[test]
    fn run_git_and_parse_against_real_repo() {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let dir = std::env::temp_dir().join(format!("puck-git-test-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();

            let setup = |args: &[&str]| {
                let output = std::process::Command::new("git")
                    .args(args)
                    .current_dir(&dir)
                    .env("GIT_AUTHOR_NAME", "puck-test")
                    .env("GIT_AUTHOR_EMAIL", "puck-test@example.com")
                    .env("GIT_COMMITTER_NAME", "puck-test")
                    .env("GIT_COMMITTER_EMAIL", "puck-test@example.com")
                    .output()
                    .unwrap();
                assert!(
                    output.status.success(),
                    "git {args:?} failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                );
            };

            setup(&["init", "-q", "-b", "main"]);
            std::fs::write(dir.join("tracked.txt"), "hello\n").unwrap();
            setup(&["add", "."]);
            setup(&["commit", "-q", "-m", "init"]);
            std::fs::write(dir.join("tracked.txt"), "changed\n").unwrap();
            std::fs::write(dir.join("new file with space.txt"), "x\n").unwrap();

            // Path argument as expected by the inner command functions.
            // 内部命令函数期望的路径参数形式。
            let path_str = dir.to_string_lossy().into_owned();

            let is_repo =
                run_git_trimmed(&["rev-parse", "--is-inside-work-tree"], &dir)
                    .await
                    .unwrap();
            assert_eq!(is_repo, "true");

            let output = run_git_trimmed(
                &["status", "--porcelain=v2", "-z", "--branch"],
                &dir,
            )
            .await
            .unwrap();
            let result = parse_status_v2(&output);

            assert!(result.is_repo);
            assert_eq!(result.branch.as_deref(), Some("main"));
            assert_eq!(result.unstaged.len(), 1);
            assert_eq!(result.unstaged[0].path, "tracked.txt");
            assert_eq!(result.untracked, vec!["new file with space.txt"]);

            // Worktree diff: original is the index blob. 工作区差异的
            // original 是 index 中的版本。
            let worktree_original =
                git_blob_content_inner(&path_str, "tracked.txt", "index")
                    .await
                    .unwrap();
            assert_eq!(worktree_original.as_deref(), Some("hello\n"));

            // Stage both files and verify the status moves them to staged.
            // 暂存两个文件并验证状态迁移。
            git_stage_inner(&path_str, &["tracked.txt".into(), "new file with space.txt".into()])
                .await
                .unwrap();
            let staged = git_status_inner(&path_str).await.unwrap();
            assert_eq!(staged.staged.len(), 2);
            assert!(staged.unstaged.is_empty());
            assert!(staged.untracked.is_empty());

            // Staged diff: original is HEAD, modified is the index blob.
            // 暂存差异的 original 是 HEAD 版本，modified 是 index 版本。
            let head_original =
                git_blob_content_inner(&path_str, "tracked.txt", "head")
                    .await
                    .unwrap();
            assert_eq!(head_original.as_deref(), Some("hello\n"));
            let index_modified =
                git_blob_content_inner(&path_str, "tracked.txt", "index")
                    .await
                    .unwrap();
            assert_eq!(index_modified.as_deref(), Some("changed\n"));

            // Commit and verify the tree becomes clean.
            // 提交并验证工作区干净。
            git_commit_inner(&path_str, "  test commit  ").await.unwrap();
            let committed = git_status_inner(&path_str).await.unwrap();
            assert!(committed.staged.is_empty());
            assert!(committed.unstaged.is_empty());
            assert!(committed.untracked.is_empty());

            // Modify again, stage, then unstage to restore worktree state.
            // 再次修改、暂存、取消暂存，验证状态还原。
            std::fs::write(dir.join("tracked.txt"), "second\n").unwrap();
            git_stage_inner(&path_str, &["tracked.txt".into()]).await.unwrap();
            git_unstage_inner(&path_str, &["tracked.txt".into()]).await.unwrap();
            let after_unstage = git_status_inner(&path_str).await.unwrap();
            assert_eq!(after_unstage.unstaged.len(), 1);
            assert_eq!(after_unstage.unstaged[0].path, "tracked.txt");
            assert!(after_unstage.staged.is_empty());

            // Discard the worktree modification and verify a clean tree.
            // 放弃工作区修改并验证工作区干净。
            git_discard_inner(&path_str, &["tracked.txt".into()]).await.unwrap();
            let after_discard = git_status_inner(&path_str).await.unwrap();
            assert!(after_discard.unstaged.is_empty());

            // Empty commit messages are rejected. 空提交信息被拒绝。
            let empty_error = git_commit_inner(&path_str, "   ").await.unwrap_err();

            let _ = empty_error;

            // History contains both commits, newest first.
            // 历史包含两条提交，最新在前。
            let history = git_log_inner(&path_str, 10).await.unwrap();
            assert_eq!(history.len(), 2);
            assert_eq!(history[0].subject, "test commit");
            assert_eq!(history[1].subject, "init");

            // Branch list marks the current branch, then checkout switches it.
            // 分支列表标记当前分支；checkout 切换后状态随之变化。
            let branches = git_branches_inner(&path_str).await.unwrap();
            assert_eq!(branches.len(), 1);
            assert!(branches[0].is_current);
            assert_eq!(branches[0].name, "main");

            setup(&["branch", "feature-zh分支"]);
            let two_branches = git_branches_inner(&path_str).await.unwrap();
            assert_eq!(two_branches.len(), 2);
            assert!(two_branches
                .iter()
                .any(|branch| branch.is_current && branch.name == "main"));
            assert!(two_branches
                .iter()
                .any(|branch| !branch.is_current && branch.name == "feature-zh分支"));

            git_checkout_inner(&path_str, "feature-zh分支").await.unwrap();
            let on_feature = git_status_inner(&path_str).await.unwrap();
            assert_eq!(on_feature.branch.as_deref(), Some("feature-zh分支"));

            git_checkout_inner(&path_str, "main").await.unwrap();
            let back_on_main = git_status_inner(&path_str).await.unwrap();
            assert_eq!(back_on_main.branch.as_deref(), Some("main"));

            // Empty branch names are rejected. 空分支名被拒绝。
            let empty_branch_error =
                git_checkout_inner(&path_str, "   ").await.unwrap_err();
            let _ = empty_branch_error;

            let _ = std::fs::remove_dir_all(&dir);
        });
    }

    #[test]
    fn network_errors_are_classified() {
        assert_eq!(
            classify_network_error(
                "fatal: Authentication failed for 'https://example.com/repo.git'"
            ),
            Some("auth")
        );
        assert_eq!(
            classify_network_error(
                "fatal: could not read Username for 'https://example.com': terminal prompts disabled"
            ),
            Some("auth")
        );
        assert_eq!(
            classify_network_error(
                "fatal: The current branch main has no upstream branch."
            ),
            Some("no_upstream")
        );
        assert_eq!(
            classify_network_error(
                "fatal: unable to access 'https://example.com/repo.git': Could not resolve host: example.com"
            ),
            Some("network")
        );
        assert_eq!(
            classify_network_error(
                "fatal: 'origin' does not appear to be a git repository"
            ),
            Some("network")
        );
        assert_eq!(
            classify_network_error("fatal: not a git repository"),
            None
        );
    }

    /// End-to-end network workflow against a local bare remote.
    ///
    /// 基于本地 bare 仓库的网络操作端到端检查：push 自动发布分支、第二个
    /// clone 推进远端后原仓库 fetch/pull 快进，最后再 push 新提交。
    #[test]
    fn fetch_pull_push_against_local_bare_remote() {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let base =
                std::env::temp_dir().join(format!("puck-git-net-test-{}", std::process::id()));
            let remote_dir = base.join("remote.git");
            let local_dir = base.join("local");
            let clone_dir = base.join("clone2");
            let _ = std::fs::remove_dir_all(&base);
            std::fs::create_dir_all(&local_dir).unwrap();

            let run_setup = |dir: &std::path::Path, args: &[&str]| {
                let output = std::process::Command::new("git")
                    .args(args)
                    .current_dir(dir)
                    .env("GIT_AUTHOR_NAME", "puck-test")
                    .env("GIT_AUTHOR_EMAIL", "puck-test@example.com")
                    .env("GIT_COMMITTER_NAME", "puck-test")
                    .env("GIT_COMMITTER_EMAIL", "puck-test@example.com")
                    .output()
                    .unwrap();
                assert!(
                    output.status.success(),
                    "git {args:?} failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                );
            };

            run_setup(
                &base,
                &["init", "--bare", "-q", "-b", "main", "remote.git"],
            );
            run_setup(&local_dir, &["init", "-q", "-b", "main"]);
            std::fs::write(local_dir.join("file.txt"), "one\n").unwrap();
            run_setup(&local_dir, &["add", "."]);
            run_setup(&local_dir, &["commit", "-q", "-m", "init"]);
            run_setup(
                &local_dir,
                &["remote", "add", "origin", remote_dir.to_string_lossy().as_ref()],
            );

            let local_path = local_dir.to_string_lossy().into_owned();

            // Push publishes the current branch with --set-upstream.
            // push 自动以 --set-upstream 发布当前分支。
            let publish = git_push_inner(&local_path).await.unwrap();
            assert!(publish.ok);

            // A second clone advances the remote; the original repo falls
            // behind and can be fast-forwarded via fetch + pull.
            // 第二个 clone 推进远端；原仓库落后并通过 fetch/pull 快进。
            run_setup(&base, &["clone", "-q", remote_dir.to_string_lossy().as_ref(), "clone2"]);
            std::fs::write(clone_dir.join("other.txt"), "two\n").unwrap();
            run_setup(&clone_dir, &["add", "."]);
            run_setup(&clone_dir, &["commit", "-q", "-m", "advance"]);
            run_setup(&clone_dir, &["push", "-q"]);

            let fetch = git_fetch_inner(&local_path).await.unwrap();
            assert!(fetch.ok);

            let before_pull = git_status_inner(&local_path).await.unwrap();
            assert_eq!(before_pull.behind, Some(1));

            let pull = git_pull_inner(&local_path).await.unwrap();
            assert!(pull.ok);

            let after_pull = git_status_inner(&local_path).await.unwrap();
            // With an upstream configured, porcelain-v2 always reports
            // ahead/behind, so a synced branch reads +0 -0.
            // 配置了 upstream 后 porcelain-v2 始终输出 ahead/behind，同步后
            // 为 +0 -0。
            assert_eq!(after_pull.behind, Some(0));

            // Push the local repo's own advance and verify the remote ref
            // matches.
            // 推送原仓库的新提交并验证远端引用一致。
            std::fs::write(local_dir.join("file.txt"), "three\n").unwrap();
            run_setup(&local_dir, &["add", "."]);
            run_setup(&local_dir, &["commit", "-q", "-m", "local advance"]);
            let second_push = git_push_inner(&local_path).await.unwrap();
            assert!(second_push.ok);

            let remote_head = std::process::Command::new("git")
                .args(["rev-parse", "main"])
                .current_dir(&remote_dir)
                .output()
                .unwrap();
            assert!(remote_head.status.success());
            let local_head =
                run_setup_output(&local_dir, &["rev-parse", "HEAD"]);
            assert_eq!(
                String::from_utf8_lossy(&remote_head.stdout).trim(),
                String::from_utf8_lossy(&local_head.stdout).trim()
            );

            // Failures against an invalid remote are classified as network
            // errors instead of hard command errors.
            // 无效远端的失败被归类为 network 错误而不是硬命令错误。
            let broken = run_git_trimmed(
                &["fetch", "broken-remote"],
                &local_dir.as_path(),
            )
            .await;
            assert!(broken.is_err());
            if let Err(error) = &broken {
                let payload = error.clone().to_payload();
                assert_eq!(
                    classify_network_error(&payload.message),
                    Some("network")
                );
            }

            let _ = std::fs::remove_dir_all(&base);
        });
    }

    fn run_setup_output(dir: &std::path::Path, args: &[&str]) -> std::process::Output {
        std::process::Command::new("git")
            .args(args)
            .current_dir(dir)
            .env("GIT_AUTHOR_NAME", "puck-test")
            .env("GIT_AUTHOR_EMAIL", "puck-test@example.com")
            .env("GIT_COMMITTER_NAME", "puck-test")
            .env("GIT_COMMITTER_EMAIL", "puck-test@example.com")
            .output()
            .unwrap()
    }
}

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub kind: String,
    pub args: Vec<String>,
}

pub fn list_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    #[cfg(not(target_os = "windows"))]
    {
        shells.extend(detect_unix_shells());
    }

    #[cfg(target_os = "windows")]
    {
        shells.extend(detect_windows_shells());
        shells.extend(detect_wsl_distros());
    }

    if shells.is_empty() {
        shells.push(fallback_shell());
    }

    shells
}

#[cfg(not(target_os = "windows"))]
fn detect_unix_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let candidates: Vec<(&str, &str)> = vec![
        ("zsh", "/bin/zsh"),
        ("bash", "/bin/bash"),
        ("fish", "/usr/bin/fish"),
        ("fish", "/usr/local/bin/fish"),
    ];

    if let Ok(default_shell) = std::env::var("SHELL") {
        if std::path::Path::new(&default_shell).exists() {
            let kind = shell_kind_from_path(&default_shell);
            if seen.insert(default_shell.clone()) {
                shells.push(ShellInfo {
                    id: format!("{kind}:default"),
                    name: format!("{} (default)", kind),
                    path: default_shell.clone(),
                    kind: kind.to_string(),
                    args: Vec::new(),
                });
            }
        }
    }

    for (kind, path) in candidates {
        if std::path::Path::new(path).exists() && seen.insert(path.to_string()) {
            shells.push(ShellInfo {
                id: format!("{kind}:{path}"),
                name: kind.to_string(),
                path: path.to_string(),
                kind: kind.to_string(),
                args: Vec::new(),
            });
        }
    }

    shells
}

#[cfg(target_os = "windows")]
fn detect_windows_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    let powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
    if std::path::Path::new(powershell).exists() {
        shells.push(ShellInfo {
            id: "powershell:system".into(),
            name: "PowerShell".into(),
            path: powershell.into(),
            kind: "powershell".into(),
            args: Vec::new(),
        });
    }

    let pwsh = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
    if std::path::Path::new(pwsh).exists() {
        shells.push(ShellInfo {
            id: "powershell:7".into(),
            name: "PowerShell 7".into(),
            path: pwsh.into(),
            kind: "powershell".into(),
            args: Vec::new(),
        });
    }

    let cmd = "C:\\Windows\\System32\\cmd.exe";
    if std::path::Path::new(cmd).exists() {
        shells.push(ShellInfo {
            id: "cmd:system".into(),
            name: "Command Prompt".into(),
            path: cmd.into(),
            kind: "cmd".into(),
            args: Vec::new(),
        });
    }

    shells
}

#[cfg(target_os = "windows")]
fn detect_wsl_distros() -> Vec<ShellInfo> {
    let output = std::process::Command::new("wsl")
        .args(["-l", "-q"])
        .output();

    let Ok(output) = output else {
        return Vec::new();
    };

    let text = String::from_utf8_lossy(&output.stdout)
        .replace('\0', "")
        .replace('\u{feff}', "");
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|distro| ShellInfo {
            id: format!("wsl:{distro}"),
            name: format!("WSL {distro}"),
            path: "wsl.exe".into(),
            kind: "wsl".into(),
            args: vec!["-d".into(), distro.into()],
        })
        .collect()
}

fn shell_kind_from_path(path: &str) -> &str {
    let file = std::path::Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("shell");

    match file {
        "zsh" => "zsh",
        "bash" => "bash",
        "fish" => "fish",
        "sh" => "sh",
        "pwsh" | "powershell" => "powershell",
        "cmd" => "cmd",
        _ => file,
    }
}

fn fallback_shell() -> ShellInfo {
    #[cfg(windows)]
    {
        ShellInfo {
            id: "cmd:fallback".into(),
            name: "Command Prompt".into(),
            path: "cmd.exe".into(),
            kind: "cmd".into(),
            args: Vec::new(),
        }
    }

    #[cfg(not(windows))]
    {
        ShellInfo {
            id: "sh:fallback".into(),
            name: "sh".into(),
            path: "/bin/sh".into(),
            kind: "sh".into(),
            args: Vec::new(),
        }
    }
}

pub fn find_shell(shell_id: Option<&str>) -> ShellInfo {
    let shells = list_shells();
    if let Some(id) = shell_id {
        if let Some(shell) = shells.iter().find(|shell| shell.id == id) {
            return shell.clone();
        }
    }
    shells
        .into_iter()
        .next()
        .unwrap_or_else(fallback_shell)
}

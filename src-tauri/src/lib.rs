mod connections_window;
mod credential;
mod error;
mod known_hosts;
mod runtime;
mod session;
mod settings_window;
mod sftp;
mod shell;
mod ssh;
mod terminal;
mod transfer;
mod workspace;

use std::sync::Arc;

use known_hosts::KnownHostsStore;

#[cfg(target_os = "macos")]
pub(crate) fn apply_macos_window_effects(window: &tauri::WebviewWindow) {
    use tauri::window::{Effect, EffectState, EffectsBuilder};

    let _ = window.set_effects(Some(
        EffectsBuilder::new()
            .effect(Effect::WindowBackground)
            .state(EffectState::Active)
            .radius(10.0)
            .build(),
    ));
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn apply_macos_window_effects(_window: &tauri::WebviewWindow) {}

#[cfg(target_os = "macos")]
fn configure_macos_window(app: &tauri::App) {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        apply_macos_window_effects(&window);
    }
}

#[tauri::command]
fn apply_macos_window_chrome(
    app: tauri::AppHandle,
    label: String,
) -> Result<(), String> {
    use tauri::Manager;

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("window not found: {label}"))?;
    apply_macos_window_effects(&window);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(KnownHostsStore::new()))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            configure_macos_window(app);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            terminal::list_shells,
            terminal::get_system_identity,
            terminal::open_local_terminal,
            terminal::write_terminal,
            terminal::resize_terminal,
            terminal::close_session,
            ssh::open_ssh_terminal,
            ssh::reconnect_ssh_terminal,
            sftp::open_file_connection,
            sftp::list_remote_dir,
            sftp::mkdir_remote,
            sftp::delete_remote,
            sftp::rename_remote,
            sftp::start_transfer,
            credential::save_credential,
            credential::delete_credential,
            credential::delete_connection_credentials,
            known_hosts::list_known_hosts,
            known_hosts::trust_ssh_host_key,
            apply_macos_window_chrome,
            settings_window::open_settings_window,
            connections_window::open_connections_window,
            workspace::list_local_dir,
            workspace::git_status,
            workspace::open_path_in_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

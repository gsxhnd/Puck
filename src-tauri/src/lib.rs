//! Tauri application entry point and command registry.
//!
//! Puck 桌面端的 Rust 入口。聚合所有功能模块（终端、SSH、SFTP、凭据、配置、
//! known hosts、窗口管理等），初始化共享的全局 state，应用 macOS 窗口效果，
//! 并把全部 `#[tauri::command]` 注册到调用处理器中供前端 invoke 调用。

mod config;
mod themes;
mod connections_window;
mod credential;
mod editor_window;
mod error;
mod known_hosts;
#[cfg(target_os = "macos")]
mod macos_menu;
mod runtime;
mod session;
mod settings_window;
mod sftp;
mod shell;
mod ssh;
mod system_monitor;
mod terminal;
mod transfer;
mod workspace;

use std::sync::Arc;

use config::PuckConfigStore;
use known_hosts::KnownHostsStore;

/// Applies the translucent vibrancy material to a macOS window.
///
/// 为 macOS 窗口应用半透明的"窗口背景"材质（vibrancy），实现毛玻璃效果；
/// 在非 macOS 平台上为一个空实现。
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

/// Builds and runs the Tauri application until the last window closes.
///
/// 构建并启动 Tauri 应用：创建共享配置存储与 known hosts 存储并注册为全局
/// state，安装对话框/opener 插件，完成 macOS 窗口装饰，注册所有命令后进入
/// 事件循环，直到应用退出。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_store = Arc::new(PuckConfigStore::new());
    let _themes_state = themes::ThemesState::new();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(config_store.clone())
        .manage(Arc::new(KnownHostsStore::new(config_store)))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            configure_macos_window(app);

            Ok(())
        });

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .enable_macos_default_menu(false)
            .menu(|app| macos_menu::build_app_menu(app))
            .on_menu_event(|app, event| {
                macos_menu::handle_menu_event(app, event);
            });
    }

    builder
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
            sftp::read_remote_file_command,
            sftp::write_remote_file_command,
            credential::save_credential,
            credential::has_credential,
            credential::delete_credential,
            credential::delete_connection_credentials,
            config::get_config_dir,
            config::get_config_file_path,
            config::load_puck_config_sections,
            config::get_puck_config_section,
            config::set_puck_config_section,
            config::remove_puck_config_section,
            themes::get_themes_dir,
            themes::list_color_themes_command,
            themes::read_color_theme_css_command,
            known_hosts::get_known_hosts_file_path,
            known_hosts::list_known_hosts,
            known_hosts::delete_known_host,
            known_hosts::trust_ssh_host_key,
            apply_macos_window_chrome,
            settings_window::open_settings_window,
            connections_window::open_connections_window,
            editor_window::open_editor_window,
            workspace::list_local_dir,
            workspace::read_local_file,
            workspace::write_local_file,
            workspace::git_status,
            workspace::open_path_in_app,
            system_monitor::get_system_stats,
            system_monitor::get_remote_system_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

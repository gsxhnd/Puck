//! macOS application menu bar.
//!
//! 为 macOS 构建原生菜单栏，将常用操作映射到快捷键，并通过事件把自定义
//! 菜单项转发给主窗口前端处理。

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Emitter, Wry, menu::{Menu, MenuItem, PredefinedMenuItem, Submenu}, Manager};

#[cfg(target_os = "macos")]
pub fn build_app_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let app_menu = Submenu::with_items(
        app,
        "Puck",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Puck"), None)?,
            &MenuItem::with_id(
                app,
                "open_settings",
                "Settings...",
                true,
                Some("CmdOrCtrl+,"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(
                app,
                "new_terminal",
                "New Terminal",
                true,
                Some("CmdOrCtrl+T"),
            )?,
            &MenuItem::with_id(app, "new_connection", "New Connection", true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "browse_connections",
                "Manage Connections",
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "close_tab", "Close Tab", true, Some("CmdOrCtrl+W"))?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(
                app,
                "command_palette",
                "Command Palette",
                true,
                Some("CmdOrCtrl+K"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "toggle_primary_panel",
                "Toggle Primary Panel",
                true,
                Some("CmdOrCtrl+Shift+L"),
            )?,
            &MenuItem::with_id(
                app,
                "toggle_second_panel",
                "Toggle Secondary Panel",
                true,
                Some("CmdOrCtrl+Shift+R"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "find", "Find", true, Some("CmdOrCtrl+F"))?,
            &MenuItem::with_id(
                app,
                "find_in_all_tabs",
                "Find in All Tabs",
                true,
                Some("CmdOrCtrl+Shift+F"),
            )?,
            &MenuItem::with_id(
                app,
                "jump_to_outline",
                "Jump to Command Outline",
                true,
                Some("CmdOrCtrl+J"),
            )?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
        ],
    )
}

#[cfg(target_os = "macos")]
pub fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().0.as_str() {
        "open_settings" => {
            let _ = crate::settings_window::open_settings_window(app.clone());
        }
        action => emit_menu_action_to_main(app, action),
    }
}

#[cfg(target_os = "macos")]
fn emit_menu_action_to_main(app: &AppHandle, action: &str) {
    let Some(main) = app.get_webview_window("main") else {
        return;
    };

    let _ = main.show();
    let _ = main.set_focus();
    let _ = main.emit("puck:menu-action", action);
}

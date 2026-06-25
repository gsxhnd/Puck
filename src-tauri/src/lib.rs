mod credential;
mod error;
mod known_hosts;
mod runtime;
mod session;
mod sftp;
mod shell;
mod ssh;
mod terminal;
mod transfer;

use std::sync::Arc;

use known_hosts::KnownHostsStore;
use session::SessionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(KnownHostsStore::new()))
        .invoke_handler(tauri::generate_handler![
            terminal::list_shells,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

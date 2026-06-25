use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgressEvent {
    pub transfer_id: String,
    pub bytes_transferred: u64,
    pub bytes_total: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferDoneEvent {
    pub transfer_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferErrorEvent {
    pub transfer_id: String,
    pub message: String,
}

pub fn emit_transfer_progress(
    app: &AppHandle,
    transfer_id: &str,
    bytes_transferred: u64,
    bytes_total: Option<u64>,
) {
    let _ = app.emit(
        "transfer:progress",
        TransferProgressEvent {
            transfer_id: transfer_id.to_string(),
            bytes_transferred,
            bytes_total,
        },
    );
}

pub fn emit_transfer_done(app: &AppHandle, transfer_id: &str) {
    let _ = app.emit(
        "transfer:done",
        TransferDoneEvent {
            transfer_id: transfer_id.to_string(),
        },
    );
}

pub fn emit_transfer_error(app: &AppHandle, transfer_id: &str, message: String) {
    let _ = app.emit(
        "transfer:error",
        TransferErrorEvent {
            transfer_id: transfer_id.to_string(),
            message,
        },
    );
}

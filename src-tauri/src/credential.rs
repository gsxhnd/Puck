const SERVICE: &str = "puck";

fn entry_key(connection_id: &str, field: &str) -> String {
    format!("puck.connection.{connection_id}.{field}")
}

#[tauri::command]
pub fn save_credential(
    connection_id: String,
    field: String,
    secret: String,
) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &entry_key(&connection_id, &field))
        .map_err(|error| error.to_string())?;
    entry
        .set_password(&secret)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_credential(connection_id: String, field: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &entry_key(&connection_id, &field))
        .map_err(|error| error.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn delete_connection_credentials(connection_id: String) -> Result<(), String> {
    for field in ["password", "passphrase"] {
        let _ = delete_credential(connection_id.clone(), field.to_string());
    }
    Ok(())
}

pub fn read_credential(connection_id: &str, field: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, &entry_key(connection_id, field))
        .map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub fn require_credential(connection_id: &str, field: &str) -> Result<String, String> {
    read_credential(connection_id, field)?
        .ok_or_else(|| format!("missing credential: {field}"))
}

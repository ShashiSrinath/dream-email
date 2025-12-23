use keyring::Entry;
use rand::RngCore;
use tauri::AppHandle;

pub async fn get_or_create_stronghold_password(_app_handle: &AppHandle) -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        let entry = Entry::new("dream-email", "stronghold-key").map_err(|e| e.to_string())?;

        match entry.get_password() {
            Ok(password) => Ok(password),
            Err(keyring::Error::NoEntry) => {
                let mut key = [0u8; 32];
                rand::thread_rng().fill_bytes(&mut key);
                let new_password = hex::encode(key);
                entry.set_password(&new_password).map_err(|e| e.to_string())?;
                Ok(new_password)
            }
            Err(e) => Err(e.to_string()),
        }
    }).await.map_err(|e| e.to_string())?
}

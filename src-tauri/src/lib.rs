use tauri::AppHandle;
use crate::email_backend::accounts::google::get_auth_url;
use crate::email_backend::accounts::manager::{Account, AccountManager};

mod email_backend;
mod utils;

#[tauri::command]
async fn login_with_google(app_handle: AppHandle) -> Result<(), String> {
    get_auth_url(&app_handle).await;
    Ok(())
}

#[tauri::command]
fn get_accounts(app_handle: AppHandle) -> Result<Vec<Account>, String> {
    let manager = AccountManager::new(&app_handle);
    let registry = manager.load()?;
    Ok(registry.accounts)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![login_with_google, get_accounts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use tauri::AppHandle;
use tauri::Manager;
use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Email {
    pub id: i64,
    pub account_id: i64,
    pub folder_id: i64,
    pub remote_id: String,
    pub message_id: Option<String>,
    pub subject: Option<String>,
    pub sender_name: Option<String>,
    pub sender_address: String,
    pub date: String,
    pub flags: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Folder {
    pub id: i64,
    pub account_id: i64,
    pub name: String,
    pub path: String,
    pub role: Option<String>,
    pub unread_count: i32,
    pub total_count: i32,
}

#[tauri::command]
pub async fn get_emails(app_handle: AppHandle, account_id: Option<i64>, folder_id: Option<i64>) -> Result<Vec<Email>, String> {
    let pool = app_handle.state::<SqlitePool>();
    
    let query = match (account_id, folder_id) {
        (Some(aid), Some(fid)) => {
            sqlx::query_as::<_, Email>("SELECT * FROM emails WHERE account_id = ? AND folder_id = ? ORDER BY date DESC LIMIT 100")
                .bind(aid)
                .bind(fid)
        }
        (Some(aid), None) => {
            sqlx::query_as::<_, Email>("SELECT * FROM emails WHERE account_id = ? ORDER BY date DESC LIMIT 100")
                .bind(aid)
        }
        _ => {
            sqlx::query_as::<_, Email>("SELECT * FROM emails ORDER BY date DESC LIMIT 100")
        }
    };

    let emails = query.fetch_all(&*pool).await.map_err(|e| e.to_string())?;
    Ok(emails)
}

#[tauri::command]
pub async fn get_folders(app_handle: AppHandle, account_id: i64) -> Result<Vec<Folder>, String> {
    let pool = app_handle.state::<SqlitePool>();
    let folders = sqlx::query_as::<_, Folder>("SELECT * FROM folders WHERE account_id = ?")
        .bind(account_id)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(folders)
}

use sqlx::sqlite::{SqlitePool, SqliteConnectOptions};
use tauri::AppHandle;
use tauri::Manager;

pub async fn setup_database(app_handle: &AppHandle) -> Result<SqlitePool, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let db_path = app_dir.join("dueam.db");

    log::info!("Database path: {:?}", db_path);

    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(options).await.map_err(|e| e.to_string())?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(pool)
}

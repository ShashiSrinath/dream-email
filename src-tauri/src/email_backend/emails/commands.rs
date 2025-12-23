use tauri::{AppHandle, Manager};
use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use crate::email_backend::accounts::manager::AccountManager;
use email::backend::BackendBuilder;
use email::imap::ImapContextBuilder;
use email::message::get::GetMessages;
use email::envelope::Id;

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
    pub snippet: Option<String>,
    pub has_attachments: bool,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct EmailContent {
    pub body_text: Option<String>,
    pub body_html: Option<String>,
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
pub async fn get_emails<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>, 
    account_id: Option<i64>, 
    folder_id: Option<i64>,
    filter: Option<String>
) -> Result<Vec<Email>, String> {
    let pool = app_handle.state::<SqlitePool>();
    
    let base_query = "SELECT id, account_id, folder_id, remote_id, message_id, subject, sender_name, sender_address, date, flags, snippet, has_attachments FROM emails";
    let mut query_parts = Vec::new();
    let mut bindings = Vec::new();

    if let Some(aid) = account_id {
        query_parts.push("account_id = ?");
        bindings.push(aid.to_string());
    }

    if let Some(fid) = folder_id {
        query_parts.push("folder_id = ?");
        bindings.push(fid.to_string());
    }

    if let Some(f) = filter {
        match f.as_str() {
            "unread" => query_parts.push("flags NOT LIKE '%\\\\Seen%'"),
            "flagged" => query_parts.push("flags LIKE '%\\\\Flagged%'"),
            _ => {}
        }
    }

    let where_clause = if query_parts.is_empty() {
        "".to_string()
    } else {
        format!("WHERE {}", query_parts.join(" AND "))
    };

    let query_str = format!("{} {} ORDER BY date DESC LIMIT 100", base_query, where_clause);
    
    let mut query = sqlx::query_as::<_, Email>(&query_str);
    for binding in bindings {
        query = query.bind(binding.parse::<i64>().unwrap());
    }

    let emails = query.fetch_all(&*pool).await.map_err(|e| e.to_string())?;

    Ok(emails)
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Attachment {
    pub id: i64,
    pub email_id: i64,
    pub filename: Option<String>,
    pub mime_type: Option<String>,
    pub size: i64,
}

#[tauri::command]
pub async fn get_email_content<R: tauri::Runtime>(app_handle: tauri::AppHandle<R>, email_id: i64) -> Result<EmailContent, String> {
    let pool = app_handle.state::<SqlitePool>();
    
    // 1. Check if we already have the content
    let content: Option<EmailContent> = sqlx::query_as::<_, EmailContent>("SELECT body_text, body_html FROM emails WHERE id = ?")
        .bind(email_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(c) = content {
        if c.body_text.is_some() || c.body_html.is_some() {
            return Ok(c);
        }
    }

    // 2. Fetch from IMAP
    let email_info: (i64, String, String) = sqlx::query_as(
        "SELECT e.account_id, e.remote_id, f.path FROM emails e JOIN folders f ON e.folder_id = f.id WHERE e.id = ?"
    )
    .bind(email_id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let (account_id, remote_id, folder_path) = email_info;
    let manager = AccountManager::new(&app_handle).await?;
    let account = manager.get_account_by_id(account_id).await?;
    let (account_config, imap_config) = account.get_configs()?;

    let backend_builder = BackendBuilder::new(
        account_config.clone(),
        ImapContextBuilder::new(account_config, imap_config),
    );

    let backend = backend_builder.build().await.map_err(|e| e.to_string())?;
    
    let id = Id::single(remote_id);
    let messages = backend.get_messages(&folder_path, &id).await.map_err(|e| e.to_string())?;
    let message = messages.first().ok_or("Email not found on server")?;

    let parsed = message.parsed().map_err(|e| e.to_string())?;
    let body_text = parsed.body_text(0).map(|b| b.to_string());
    let body_html = parsed.body_html(0).map(|b| b.to_string());

    // 3. Save to database
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE emails SET body_text = ?, body_html = ? WHERE id = ?")
        .bind(&body_text)
        .bind(&body_html)
        .bind(email_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // Extract and save attachments
    if let Ok(attachments) = message.attachments() {
        for att in attachments {
            sqlx::query(
                "INSERT INTO attachments (email_id, filename, mime_type, size, data)
                 VALUES (?, ?, ?, ?, ?)"
            )
            .bind(email_id)
            .bind(&att.filename)
            .bind(&att.mime)
            .bind(att.body.len() as i64)
            .bind(&att.body)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(EmailContent {
        body_text,
        body_html,
    })
}

#[tauri::command]
pub async fn get_attachments<R: tauri::Runtime>(app_handle: tauri::AppHandle<R>, email_id: i64) -> Result<Vec<Attachment>, String> {
    let pool = app_handle.state::<SqlitePool>();
    let attachments = sqlx::query_as::<_, Attachment>("SELECT id, email_id, filename, mime_type, size FROM attachments WHERE email_id = ?")
        .bind(email_id)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(attachments)
}

#[tauri::command]
pub async fn get_attachment_data<R: tauri::Runtime>(app_handle: tauri::AppHandle<R>, attachment_id: i64) -> Result<Vec<u8>, String> {
    let pool = app_handle.state::<SqlitePool>();
    let row: (Vec<u8>,) = sqlx::query_as("SELECT data FROM attachments WHERE id = ?")
        .bind(attachment_id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.0)
}

#[tauri::command]
pub async fn get_folders<R: tauri::Runtime>(app_handle: tauri::AppHandle<R>, account_id: i64) -> Result<Vec<Folder>, String> {
    let pool = app_handle.state::<SqlitePool>();
    let folders = sqlx::query_as::<_, Folder>("SELECT * FROM folders WHERE account_id = ?")
        .bind(account_id)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(folders)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::test_utils::setup_test_db;
    use tauri::test::mock_builder;
    use chrono::Utc;
    use sqlx::Row;

    async fn seed_test_data(pool: &SqlitePool) -> (i64, i64, i64) {
        // Create account
        let row: (i64,) = sqlx::query_as("INSERT INTO accounts (email, account_type) VALUES (?, ?) RETURNING id")
            .bind("test@example.com")
            .bind("google")
            .fetch_one(pool)
            .await
            .unwrap();
        let account_id = row.0;

        // Create folder
        let row: (i64,) = sqlx::query_as("INSERT INTO folders (account_id, name, path) VALUES (?, ?, ?) RETURNING id")
            .bind(account_id)
            .bind("Inbox")
            .bind("INBOX")
            .fetch_one(pool)
            .await
            .unwrap();
        let folder_id = row.0;

        // Create email
        let row: (i64,) = sqlx::query_as(
            "INSERT INTO emails (account_id, folder_id, remote_id, subject, sender_address, date, flags, body_text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
        )
        .bind(account_id)
        .bind(folder_id)
        .bind("remote-1")
        .bind("Test Subject")
        .bind("sender@example.com")
        .bind(Utc::now().to_rfc3339())
        .bind("[]")
        .bind("Hello content")
        .fetch_one(pool)
        .await
        .unwrap();
        let email_id = row.0;

        (account_id, folder_id, email_id)
    }

    #[tokio::test]
    async fn test_get_emails_integration() {
        use tauri::Manager;
        let pool = setup_test_db().await;
        let (account_id, folder_id, _) = seed_test_data(&pool).await;
        
        let app = mock_builder().build(tauri::generate_context!()).unwrap();
        app.manage(pool);

        let emails = get_emails(app.handle().clone(), Some(account_id), Some(folder_id), None)
            .await
            .expect("Failed to get emails");

        assert_eq!(emails.len(), 1);
        assert_eq!(emails[0].subject, Some("Test Subject".to_string()));
    }

    #[tokio::test]
    async fn test_get_email_content_cached() {
        use tauri::Manager;
        let pool = setup_test_db().await;
        let (_, _, email_id) = seed_test_data(&pool).await;
        
        let app = mock_builder().build(tauri::generate_context!()).unwrap();
        app.manage(pool);

        let content = get_email_content(app.handle().clone(), email_id)
            .await
            .expect("Failed to get email content");

        assert_eq!(content.body_text, Some("Hello content".to_string()));
    }
}

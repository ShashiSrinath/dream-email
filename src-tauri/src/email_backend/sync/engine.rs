use std::time::Duration;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use crate::email_backend::accounts::manager::{AccountManager, Account};
use crate::email_backend::accounts::google::GoogleAccount;
use tokio::time::sleep;
use log::{info, error};
use email::account::config::AccountConfig;
use email::account::config::oauth2::OAuth2Config;
use email::imap::config::{ImapConfig, ImapAuthConfig};
use email::imap::ImapContextBuilder;
use email::backend::BackendBuilder;
use email::folder::list::ListFolders;
use email::envelope::list::{ListEnvelopes, ListEnvelopesOptions};
use sqlx::SqlitePool;
use secret::Secret;

pub struct SyncEngine {
    app_handle: AppHandle,
}

impl SyncEngine {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub async fn start(&self) {
        info!("Starting Sync Engine...");
        let app_handle = self.app_handle.clone();
        
        tauri::async_runtime::spawn(async move {
            loop {
                if let Err(e) = Self::sync_all_accounts(&app_handle).await {
                    error!("Error during sync: {}", e);
                }
                
                sleep(Duration::from_secs(300)).await;
            }
        });
    }

    async fn sync_all_accounts(app_handle: &AppHandle) -> Result<(), String> {
        let manager = AccountManager::new(app_handle).await?;
        let registry = manager.load().await?;
        
        for account in registry.accounts {
            if let Err(e) = Self::sync_account(app_handle, &account).await {
                error!("Failed to sync account {}: {}", account.email(), e);
            }
        }
        
        Ok(())
    }

    async fn sync_account(app_handle: &AppHandle, account: &Account) -> Result<(), String> {
        match account {
            Account::Google(google) => {
                Self::sync_google_account(app_handle, google).await?;
            }
        }
        Ok(())
    }

    async fn sync_google_account(app_handle: &AppHandle, google: &GoogleAccount) -> Result<(), String> {
        info!("Syncing Google account: {}", google.email);

        let oauth2_config = OAuth2Config {
            client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
            auth_url: "https://accounts.google.com/o/oauth2/auth".into(),
            token_url: "https://www.googleapis.com/oauth2/v3/token".into(),
            access_token: google.access_token.as_ref().map(|t| Secret::new_raw(t.clone())).unwrap_or_default(),
            refresh_token: google.refresh_token.as_ref().map(|t| Secret::new_raw(t.clone())).unwrap_or_default(),
            ..Default::default()
        };

        let account_config = Arc::new(AccountConfig {
            name: google.email.clone(),
            email: google.email.clone(),
            ..Default::default()
        });

        let imap_config = Arc::new(ImapConfig {
            host: "imap.gmail.com".into(),
            port: 993,
            auth: ImapAuthConfig::OAuth2(oauth2_config),
            ..Default::default()
        });

        let backend_builder = BackendBuilder::new(
            account_config.clone(),
            ImapContextBuilder::new(account_config, imap_config),
        );

        let backend = backend_builder.build().await.map_err(|e| e.to_string())?;

        let folders = backend.list_folders().await.map_err(|e| e.to_string())?;
        info!("Found {} folders for {}", folders.len(), google.email);

        let pool = app_handle.state::<SqlitePool>();
        let account_id = google.id.ok_or("Account ID missing")?;

        for folder in folders {
            sqlx::query(
                "INSERT INTO folders (account_id, name, path, role) VALUES (?, ?, ?, ?)
                 ON CONFLICT(account_id, path) DO UPDATE SET name=excluded.name"
            )
            .bind(account_id)
            .bind(&folder.name)
            .bind(&folder.name)
            .bind("") 
            .execute(&*pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;

            let envelopes = backend.list_envelopes(&folder.name, ListEnvelopesOptions::default()).await.map_err(|e| e.to_string())?;
            
            let folder_row: (i64,) = sqlx::query_as("SELECT id FROM folders WHERE account_id = ? AND path = ?")
                .bind(account_id)
                .bind(&folder.name)
                .fetch_one(&*pool)
                .await
                .map_err(|e: sqlx::Error| e.to_string())?;
            let folder_id = folder_row.0;

            for env in envelopes {
                let flags: Vec<String> = env.flags.clone().into();
                sqlx::query(
                    "INSERT INTO emails (account_id, folder_id, remote_id, message_id, subject, sender_name, sender_address, date, flags)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(account_id, remote_id) DO UPDATE SET flags=excluded.flags"
                )
                .bind(account_id)
                .bind(folder_id)
                .bind(&env.id)
                .bind(&env.message_id)
                .bind(&env.subject)
                .bind(&env.from.name)
                .bind(&env.from.addr)
                .bind(env.date.to_rfc3339())
                .bind(serde_json::to_string(&flags).unwrap_or_default())
                .execute(&*pool)
                .await
                .map_err(|e: sqlx::Error| e.to_string())?;
            }
        }

        Ok(())
    }
}

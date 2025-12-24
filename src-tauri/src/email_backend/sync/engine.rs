use std::collections::HashMap;
use std::time::Duration;
use std::sync::Arc;
use std::num::NonZeroU32;
use tauri::{Manager, Emitter};
use crate::email_backend::accounts::manager::{AccountManager, Account};
use crate::email_backend::accounts::google::GoogleAccount;
use tokio::time::sleep;
use tokio::sync::{oneshot, Mutex};
use log::{info, error};
use email::imap::{ImapContext, ImapContextBuilder, ImapClient};
use email::backend::context::BackendContextBuilder;
use email::backend::BackendBuilder;
use email::folder::list::ListFolders;
use email::envelope::Envelopes;
use imap_client::tasks::tasks::select::SelectDataUnvalidated;
use sqlx::SqlitePool;

pub struct SyncEngine<R: tauri::Runtime = tauri::Wry> {
    app_handle: tauri::AppHandle<R>,
    idle_senders: Arc<Mutex<HashMap<i64, oneshot::Sender<()>>>>,
}

const SYNC_BATCH_SIZE: u32 = 500;

impl<R: tauri::Runtime> SyncEngine<R> {
    pub fn new(app_handle: tauri::AppHandle<R>) -> Self {
        Self { 
            app_handle,
            idle_senders: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start(&self) {
        info!("Starting Sync Engine...");
        let app_handle = self.app_handle.clone();
        
        // Initial sync of all accounts
        if let Err(e) = Self::sync_all_accounts(&app_handle).await {
            error!("Initial sync failed: {}", e);
        }

        // Start background periodic sync
        let app_handle_periodic = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                sleep(Duration::from_secs(300)).await;
                if let Err(e) = Self::sync_all_accounts(&app_handle_periodic).await {
                    error!("Error during periodic sync: {}", e);
                }
            }
        });

        // Start IDLE for all accounts
        if let Ok(manager) = AccountManager::new(&app_handle).await {
            if let Ok(registry) = manager.load().await {
                for account in registry.accounts {
                    let app_handle = app_handle.clone();
                    let idle_senders = self.idle_senders.clone();
                    tauri::async_runtime::spawn(async move {
                        Self::start_idle_for_account(app_handle, account, idle_senders).await;
                    });
                }
            }
        }
    }

    pub async fn refresh_folder(app_handle: &tauri::AppHandle<R>, account_id: i64, folder_id: i64) -> Result<(), String> {
        let pool = app_handle.state::<SqlitePool>();
        let folder_info: (String, Option<String>) = sqlx::query_as("SELECT path, role FROM folders WHERE id = ?")
            .bind(folder_id)
            .fetch_one(&*pool)
            .await
            .map_err(|e| e.to_string())?;

        let (folder_path, folder_role) = folder_info;

        let manager = AccountManager::new(app_handle).await?;
        let account = manager.get_account_by_id(account_id).await?;
        let (account_config, imap_config, _) = account.get_configs()?;

        let backend_builder = BackendBuilder::new(
            account_config.clone(),
            ImapContextBuilder::new(account_config, imap_config),
        );

        let backend = backend_builder.build().await.map_err(|e| e.to_string())?;
        let context = (*backend.context).clone();
        let mut client = context.client().await;
        
        let folder_data = client.examine_mailbox(&folder_path).await.map_err(|e| e.to_string())?;
        
        Self::sync_folder(app_handle, &mut *client, &account, &folder_path, folder_role, &folder_data).await?;
        
        let _ = app_handle.emit("emails-updated", account_id);
        
        Ok(())
    }

    async fn save_envelopes(
        app_handle: &tauri::AppHandle<R>,
        account_id: i64,
        folder_id: i64,
        envelopes: Envelopes,
    ) -> Result<(), String> {
        let pool = app_handle.state::<SqlitePool>();
        for env in envelopes {
            let flags: Vec<String> = env.flags.clone().into();
            sqlx::query(
                "INSERT INTO emails (account_id, folder_id, remote_id, message_id, subject, sender_name, sender_address, date, flags)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(folder_id, remote_id) DO UPDATE SET 
                    flags=excluded.flags"
            )
            .bind(account_id)
            .bind(folder_id)
            .bind(&env.id)
            .bind(&env.message_id)
            .bind(&env.subject)
            .bind(&env.from.name)
            .bind(&env.from.addr)
            .bind(env.date.with_timezone(&chrono::Utc).to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
            .bind(serde_json::to_string(&flags).unwrap_or_default())
            .execute(&*pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;
        }
        Ok(())
    }

    async fn start_idle_for_account(app_handle: tauri::AppHandle<R>, account: Account, idle_senders: Arc<Mutex<HashMap<i64, oneshot::Sender<()>>>>) {
        let account_id = match account.id() {
            Some(id) => id,
            None => return,
        };

        info!("Starting IDLE for account: {}", account.email());

        let (tx, mut rx) = oneshot::channel();
        idle_senders.lock().await.insert(account_id, tx);

        loop {
            let res = tokio::select! {
                _ = &mut rx => {
                    info!("Stopping IDLE for account: {}", account.email());
                    break;
                }
                res = Self::run_idle_loop(&app_handle, &account) => res,
            };

            if let Err(e) = res {
                error!("IDLE loop error for {}: {}. Retrying in 30s...", account.email(), e);
                sleep(Duration::from_secs(30)).await;
            }
        }
    }

    async fn run_idle_loop(app_handle: &tauri::AppHandle<R>, account: &Account) -> Result<(), String> {
        let (account_config, imap_config, _) = account.get_configs()?;
        let ctx_builder = ImapContextBuilder::new(account_config.clone(), imap_config);

        let context: ImapContext = BackendContextBuilder::build(ctx_builder)
            .await
            .map_err(|e| e.to_string())?;

        let mut client = context.client().await;
        
        loop {
            info!("IDLE waiting for updates for {}...", account.email());
            
            // Select INBOX and get current state
            let folder_data = client.examine_mailbox("INBOX").await.map_err(|e| e.to_string())?;
            
            // Sync current state
            Self::sync_folder(app_handle, &mut *client, account, "INBOX", Some("inbox".to_string()), &folder_data).await?;
            let _ = app_handle.emit("emails-updated", account.id());

            let (_shutdown_tx, mut shutdown_rx) = oneshot::channel();
            client.idle(&mut shutdown_rx).await.map_err(|e| e.to_string())?;
            info!("IDLE notification received for {}", account.email());
        }
    }

    async fn sync_folder(
        app_handle: &tauri::AppHandle<R>, 
        client: &mut ImapClient, 
        account: &Account, 
        folder_name: &str,
        role: Option<String>,
        folder_data: &SelectDataUnvalidated
    ) -> Result<(), String> {
        let account_id = account.id().ok_or("Account ID missing")?;
        let pool = app_handle.state::<SqlitePool>();

        let current_uid_validity = folder_data.uid_validity.map(|u: NonZeroU32| u.get() as i64).unwrap_or(0);
        let current_uid_next = folder_data.uid_next.map(|u: NonZeroU32| u.get() as i64).unwrap_or(0);
        let total_count = folder_data.exists.unwrap_or(0) as i64;

        // 1. Get stored folder info
        let stored_folder: Option<(i64, i64, i64, Option<String>)> = sqlx::query_as(
            "SELECT id, uid_validity, uid_next, role FROM folders WHERE account_id = ? AND path = ?"
        )
        .bind(account_id)
        .bind(folder_name)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;

        let (folder_id, stored_uid_validity, stored_uid_next) = match stored_folder {
            Some((id, uv, un, stored_role)) => {
                // If role changed or was empty, update it
                if let Some(ref new_role) = role {
                    if stored_role.as_ref() != Some(new_role) {
                        sqlx::query("UPDATE folders SET role = ? WHERE id = ?")
                            .bind(new_role)
                            .bind(id)
                            .execute(&*pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
                (id, uv, un)
            },
            None => {
                // Folder not in DB yet, insert it
                let row: (i64,) = sqlx::query_as(
                    "INSERT INTO folders (account_id, name, path, role, uid_validity, uid_next, total_count)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     RETURNING id"
                )
                .bind(account_id)
                .bind(folder_name)
                .bind(folder_name)
                .bind(role.unwrap_or_default())
                .bind(current_uid_validity)
                .bind(current_uid_next)
                .bind(total_count)
                .fetch_one(&*pool)
                .await
                .map_err(|e| e.to_string())?;
                (row.0, 0, 0) // Treat as full sync
            }
        };

        // Handle UID validity change: clear local cache as UIDs are no longer valid
        if stored_uid_validity != 0 && stored_uid_validity != current_uid_validity {
            info!("UID validity changed for folder {} of {}, clearing local cache", folder_name, account.email());
            sqlx::query("DELETE FROM emails WHERE folder_id = ?")
                .bind(folder_id)
                .execute(&*pool)
                .await
                .map_err(|e| e.to_string())?;
        }

        if stored_uid_validity != current_uid_validity || stored_uid_next == 0 {
            info!("Performing full sync for folder {} of {}", folder_name, account.email());
            let mut end = total_count as u32;
            while end > 0 {
                let start = if end > SYNC_BATCH_SIZE { end - SYNC_BATCH_SIZE + 1 } else { 1 };
                info!("Fetching batch {}:{} for folder {} of {}", start, end, folder_name, account.email());
                
                let start_nz = NonZeroU32::new(start).unwrap_or(NonZeroU32::new(1).unwrap());
                let end_nz = NonZeroU32::new(end).unwrap_or(NonZeroU32::new(1).unwrap());
                let seq = (start_nz..=end_nz).into();

                let envelopes = client.fetch_envelopes_by_sequence(seq).await.map_err(|e| e.to_string())?;
                if envelopes.is_empty() { break; }
                
                Self::save_envelopes(app_handle, account_id, folder_id, envelopes).await?;
                let _ = app_handle.emit("emails-updated", account_id);
                
                end = if start > 1 { start - 1 } else { 0 };
            }
        } else if (stored_uid_next as u32) < (current_uid_next as u32) {
            info!("Performing incremental sync for folder {} of {} (UID {}:*)", folder_name, account.email(), stored_uid_next);
            
            let start_uid = NonZeroU32::new(stored_uid_next as u32).unwrap_or(NonZeroU32::new(1).unwrap());
            let uids = (start_uid..).into();
            let envelopes = client.fetch_envelopes(uids).await.map_err(|e| e.to_string())?;
            
            if !envelopes.is_empty() {
                Self::save_envelopes(app_handle, account_id, folder_id, envelopes).await?;
                let _ = app_handle.emit("emails-updated", account_id);
            }
        } else {
            info!("Folder {} of {} is up to date", folder_name, account.email());
        }

        // Update folder info with latest state from server
        sqlx::query(
            "UPDATE folders SET uid_validity = ?, uid_next = ?, total_count = ? WHERE id = ?"
        )
        .bind(current_uid_validity)
        .bind(current_uid_next)
        .bind(total_count)
        .bind(folder_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    async fn sync_all_accounts(app_handle: &tauri::AppHandle<R>) -> Result<(), String> {
        let manager = AccountManager::new(app_handle).await?;
        let registry = manager.load().await?;
        
        for account in registry.accounts {
            if let Err(e) = Self::sync_account(app_handle, &account).await {
                error!("Failed to sync account {}: {}", account.email(), e);
            }
        }
        
        Ok(())
    }

    async fn sync_account(app_handle: &tauri::AppHandle<R>, account: &Account) -> Result<(), String> {
        match account {
            Account::Google(google) => {
                Self::sync_google_account(app_handle, google).await?;
            }
        }
        Ok(())
    }

    async fn sync_google_account(app_handle: &tauri::AppHandle<R>, google: &GoogleAccount) -> Result<(), String> {
        info!("Syncing Google account: {}", google.email);
        let account = Account::Google(google.clone());
        let (account_config, imap_config, _) = account.get_configs()?;

        let backend_builder = BackendBuilder::new(
            account_config.clone(),
            ImapContextBuilder::new(account_config, imap_config),
        );

        let backend = backend_builder.build().await.map_err(|e| e.to_string())?;

        let folders = backend.list_folders().await.map_err(|e| e.to_string())?;
        info!("Found {} folders for {}", folders.len(), google.email);

        let context = (*backend.context).clone();

        for folder in folders {
            let role = if folder.is_inbox() {
                Some("inbox".to_string())
            } else if folder.is_sent() {
                Some("sent".to_string())
            } else if folder.is_drafts() {
                Some("drafts".to_string())
            } else if folder.is_trash() {
                Some("trash".to_string())
            } else {
                // Try to detect other roles from name if kind is not specific enough
                let name = folder.name.to_lowercase();
                if name.contains("spam") || name.contains("junk") {
                    Some("spam".to_string())
                } else if name.contains("archive") || name.contains("all mail") {
                    Some("archive".to_string())
                } else {
                    None
                }
            };

            let mut client = context.client().await;
            let folder_data = client.examine_mailbox(&folder.name).await.map_err(|e| e.to_string())?;
            Self::sync_folder(app_handle, &mut *client, &account, &folder.name, role, &folder_data).await?;
        }

        Ok(())
    }
}
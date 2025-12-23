use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::email_backend::accounts::google::GoogleAccount;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Account {
    Google(GoogleAccount),
    // Future: Imap(ImapAccount),
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AccountRegistry {
    pub accounts: Vec<Account>,
}

pub struct AccountManager {
    storage_path: PathBuf,
}

impl AccountManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        let mut storage_path = app_handle.path().app_data_dir().expect("failed to get app data dir");
        if !storage_path.exists() {
            fs::create_dir_all(&storage_path).expect("failed to create app data dir");
        }
        storage_path.push("accounts.json");
        AccountManager { storage_path }
    }

    pub fn load(&self) -> Result<AccountRegistry, String> {
        if !self.storage_path.exists() {
            return Ok(AccountRegistry::default());
        }
        let content = fs::read_to_string(&self.storage_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    }

    pub fn save(&self, registry: &AccountRegistry) -> Result<(), String> {
        let content = serde_json::to_string_pretty(registry).map_err(|e| e.to_string())?;
        fs::write(&self.storage_path, content).map_err(|e| e.to_string())
    }

    pub fn add_account(&self, account: Account) -> Result<(), String> {
        let mut registry = self.load()?;
        registry.accounts.push(account);
        self.save(&registry)
    }
}

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_stronghold::stronghold::Stronghold;
use crate::utils::security::get_or_create_stronghold_password;
use crate::email_backend::accounts::google::GoogleAccount;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", content = "data")]
pub enum Account {
    Google(GoogleAccount),
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AccountRegistry {
    pub accounts: Vec<Account>,
}

pub struct AccountManager {
    app_handle: AppHandle,
}

impl AccountManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        Self {
            app_handle: app_handle.clone(),
        }
    }

    async fn get_stronghold(&self) -> Result<Stronghold, String> {
        let password = get_or_create_stronghold_password(&self.app_handle).await?;
        let stronghold_path = self.app_handle.path().app_data_dir()
            .map_err(|e| e.to_string())?
            .join("stronghold.bin");
        
        // Ensure parent directory exists
        if let Some(parent) = stronghold_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        Stronghold::new(stronghold_path, password.into_bytes()).map_err(|e| e.to_string())
    }

    pub async fn load(&self) -> Result<AccountRegistry, String> {
        let stronghold = self.get_stronghold().await?;
        let client = stronghold.load_client("accounts").map_err(|e| e.to_string())?;
        let store = client.store();

        match store.get(b"registry").map_err(|e| e.to_string())? {
            Some(data) => {
                serde_json::from_slice(&data).map_err(|e| e.to_string())
            }
            None => Ok(AccountRegistry::default()),
        }
    }

    pub async fn save(&self, registry: &AccountRegistry) -> Result<(), String> {
        let stronghold = self.get_stronghold().await?;
        let client = stronghold.load_client("accounts").map_err(|e| e.to_string())?;
        let store = client.store();

        let data = serde_json::to_vec(registry).map_err(|e| e.to_string())?;
        store.insert(b"registry".to_vec(), data, None).map_err(|e| e.to_string())?;
        
        stronghold.save().map_err(|e| e.to_string())
    }

    pub async fn add_account(&self, account: Account) -> Result<(), String> {
        let mut registry = self.load().await?;
        registry.accounts.push(account);
        self.save(&registry).await
    }

    pub async fn remove_account(&self, index: usize) -> Result<(), String> {
        let mut registry = self.load().await?;
        if index < registry.accounts.len() {
            registry.accounts.remove(index);
            self.save(&registry).await
        } else {
            Err("Account index out of bounds".to_string())
        }
    }
}

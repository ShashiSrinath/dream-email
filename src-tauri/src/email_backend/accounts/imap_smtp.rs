use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImapSmtpAccount {
    pub id: Option<i64>,
    pub email: String,
    pub name: Option<String>,
    pub imap_host: String,
    pub imap_port: u16,
    pub imap_username: String,
    pub imap_encryption: String, // "tls", "starttls", "none"
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_username: String,
    pub smtp_encryption: String, // "tls", "starttls", "none"
    pub smtp_use_imap_credentials: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub smtp_password: Option<String>,
}

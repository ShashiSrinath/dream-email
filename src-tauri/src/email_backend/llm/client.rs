use langchain_rust::llm::openai::{OpenAI, OpenAIConfig};
use sqlx::SqlitePool;
use tauri::Manager;

pub async fn get_openai_client<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) -> Result<OpenAI<OpenAIConfig>, String> {
    let pool = app_handle.state::<SqlitePool>();
    
    let rows: Vec<(String, String)> = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings WHERE key IN ('aiApiKey', 'aiBaseUrl', 'aiModel')")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
        
    let mut api_key = String::new();
    let mut base_url = String::from("https://api.openai.com/v1");
    let mut model = String::new();

    for (key, value) in rows {
        // Values are stored as JSON strings
        let unquoted = serde_json::from_str::<String>(&value).unwrap_or(value);
        match key.as_str() {
            "aiApiKey" => api_key = unquoted,
            "aiBaseUrl" => base_url = unquoted,
            "aiModel" => model = unquoted,
            _ => {}
        }
    }

    let config = OpenAIConfig::default()
        .with_api_key(api_key)
        .with_api_base(base_url);

    let client = OpenAI::default()
        .with_config(config)
        .with_model(model);
        
    Ok(client)
}

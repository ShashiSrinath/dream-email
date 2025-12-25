use langchain_rust::chain::{Chain, LLMChainBuilder};
use langchain_rust::{prompt_args, template_fstring};
use serde_json::Value;
use crate::email_backend::llm::client::get_openai_client;

pub async fn enrich_sender_with_ai<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    sender_address: &str,
    email_snippets: Vec<String>,
) -> Result<Value, String> {
    let client = get_openai_client(app_handle).await?;

    let prompt = template_fstring!(
        r#"You are an expert at extracting professional information from email snippets.
Extract the following information about the sender '{sender}' from these email snippets:
- Job Title
- Company
- A brief professional bio (max 2 sentences)
- is_personal_email: true if the sender appears to be an individual's personal email, false otherwise. (joh.doe@gmail.com and john.doe@company.com are both valid for this)
- is_automated_mailer: true if the sender appears to be an automated mailing service or newsletter, false otherwise.

Emails:
{emails}

Respond ONLY with a JSON object containing keys: 'job_title', 'company', 'bio', 'is_personal_email', 'is_automated_mailer'.
If a piece of information is not found, use null.
Example response: {{"job_title": "Software Engineer", "company": "Google", "bio": "A passionate developer working on AI.", "is_personal_email": false, "is_automated_mailer": true}}"#,
        "sender", "emails"
    );

    let emails_combined = email_snippets.join("\n---\n");

    let chain = LLMChainBuilder::new()
        .prompt(prompt)
        .llm(client)
        .build()
        .map_err(|e| e.to_string())?;

    let response = chain.invoke(prompt_args! {
        "sender" => sender_address,
        "emails" => emails_combined,
    }).await.map_err(|e| e.to_string())?;

    // The response is usually a string, try to parse it as JSON
    let cleaned_response = response.trim().trim_start_matches("```json").trim_end_matches("```").trim();
    let json_val: Value = serde_json::from_str(cleaned_response)
        .map_err(|e| format!("Failed to parse AI response as JSON: {}. Response: {}", e, cleaned_response))?;

    Ok(json_val)
}

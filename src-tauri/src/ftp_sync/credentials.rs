use serde::{Deserialize, Serialize};
use crate::error::AppError;
use crate::legacy_fetch::API_TOKEN;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use reqwest::Client;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FtpSettings {
    pub host: String,
    pub user: String,
    pub pass: String,
    pub port: u16,
    pub root: String,
}

/// Fetch FTP credentials from a dynamic URL
/// The response is Base64 encoded and contains key=value lines
pub async fn fetch_ftp_credentials(url: &str) -> Result<FtpSettings, AppError> {
    let client = Client::builder()
        .use_rustls_tls()
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert("Api-Token", API_TOKEN.parse().unwrap());
            headers
        })
        .build()
        .unwrap_or_default();

    let response = client.get(url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch FTP credentials: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(format!(
            "FTP credentials API returned error status: {}",
            response.status()
        )));
    }

    let encoded = response.text().await.map_err(|e| {
        AppError::Internal(format!("Failed to read FTP credentials body: {}", e))
    })?;

    // Decode Base64
    let decoded_bytes = STANDARD.decode(encoded.trim()).map_err(|e| {
        AppError::Internal(format!("Failed to decode FTP credentials: {}", e))
    })?;

    let decoded_str = String::from_utf8(decoded_bytes).map_err(|e| {
        AppError::Internal(format!("Invalid UTF-8 in FTP credentials: {}", e))
    })?;

    // Parse key=value lines
    let mut settings = FtpSettings::default();
    for line in decoded_str.lines() {
        let parts: Vec<&str> = line.splitn(2, '=').collect();
        if parts.len() == 2 {
            let key = parts[0].trim();
            let value = parts[1].trim();
            match key {
                "host" => settings.host = value.to_string(),
                "user" => settings.user = value.to_string(),
                "pass" => settings.pass = value.to_string(),
                "port" => settings.port = value.parse().unwrap_or(21),
                "root" => settings.root = value.to_string(),
                _ => {}
            }
        }
    }

    if settings.host.is_empty() || settings.user.is_empty() {
        return Err(AppError::Internal("Incomplete FTP credentials".to_string()));
    }

    Ok(settings)
}

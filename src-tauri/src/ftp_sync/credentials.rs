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
    pub lang: String,
}

/// Fetch FTP credentials from the dynamic `conn_ftp` URL.
///
/// The server requires `lang` and `datetime` query params to authorize the
/// connection and return FTP credentials. Without them the server returns
/// an empty body and the function fails with "Incomplete FTP credentials".
///
/// `lang` should be the active collection language ("pt", "en", "es").
pub async fn fetch_ftp_credentials(url: &str, lang: &str) -> Result<FtpSettings, AppError> {
    let client = Client::builder()
        .use_rustls_tls()
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert("Api-Token", API_TOKEN.parse().unwrap());
            headers
        })
        .build()
        .unwrap_or_default();

    // Build URL with required server params
    let datetime = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let params = format!(
        "lang={}&datetime={}",
        lang,
        urlencoding::encode(&datetime)
    );
    let url_with_params = if url.contains('?') {
        format!("{}&{}", url, params)
    } else {
        format!("{}?{}", url, params)
    };

    let response = client
        .get(&url_with_params)
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

    if encoded.trim().is_empty() {
        return Err(AppError::Internal(
            "FTP credentials server returned empty body — check that conn_ftp params are correct".to_string()
        ));
    }

    // Decode Base64
    let decoded_bytes = STANDARD.decode(encoded.trim()).map_err(|e| {
        AppError::Internal(format!("Failed to decode FTP credentials (Base64): {}", e))
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
                "user" | "username" => settings.user = value.to_string(),
                "pass" | "password" => settings.pass = value.to_string(),
                "port" => settings.port = value.parse().unwrap_or(21),
                "root" => settings.root = value.to_string(),
                "lang" => settings.lang = value.to_string(),
                _ => {}
            }
        }
    }

    if settings.host.is_empty() || settings.user.is_empty() {
        return Err(AppError::Internal(
            "Incomplete FTP credentials — host or user is missing in server response".to_string(),
        ));
    }

    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ftp_credentials() {
        let decoded_str = "host=https://louvorja.ligaosom.com.br\nport=21\nroot=/\npassword=OP3v$UjoC(SI\nusername=louvorja@louvorja.ligaosom.com.br\nlang=pt\n";

        let mut settings = FtpSettings::default();
        for line in decoded_str.lines() {
            let parts: Vec<&str> = line.splitn(2, '=').collect();
            if parts.len() == 2 {
                let key = parts[0].trim();
                let value = parts[1].trim();
                match key {
                    "host" => settings.host = value.to_string(),
                    "user" | "username" => settings.user = value.to_string(),
                    "pass" | "password" => settings.pass = value.to_string(),
                    "port" => settings.port = value.parse().unwrap_or(21),
                    "root" => settings.root = value.to_string(),
                    "lang" => settings.lang = value.to_string(),
                    _ => {}
                }
            }
        }

        assert_eq!(settings.host, "louvorja.ligaosom.com.br");
        assert_eq!(settings.user, "louvorja@louvorja.ligaosom.com.br");
        assert_eq!(settings.pass, "OP3v$UjoC(SI");
        assert_eq!(settings.port, 21);
        assert_eq!(settings.root, "/");
        assert_eq!(settings.lang, "pt");
    }

    #[test]
    fn build_conn_ftp_url_appends_required_params_no_existing_query() {
        let base_url = "https://api.louvorja.com.br/ftp";
        let lang = "pt";
        let datetime = "2026-03-17 10:00:00";
        let params = format!("lang={}&datetime={}", lang, urlencoding::encode(datetime));
        let result = if base_url.contains('?') {
            format!("{}&{}", base_url, params)
        } else {
            format!("{}?{}", base_url, params)
        };

        assert!(result.contains("lang=pt"));
        assert!(result.contains("datetime="));
        assert!(result.starts_with("https://api.louvorja.com.br/ftp?"));
    }

    #[test]
    fn build_conn_ftp_url_appends_params_to_existing_query_string() {
        let base_url = "https://api.louvorja.com.br/ftp?token=abc";
        let lang = "es";
        let datetime = "2026-03-17 10:00:00";
        let params = format!("lang={}&datetime={}", lang, urlencoding::encode(datetime));
        let result = if base_url.contains('?') {
            format!("{}&{}", base_url, params)
        } else {
            format!("{}?{}", base_url, params)
        };

        assert!(result.contains("token=abc"));
        assert!(result.contains("lang=es"));
        assert!(result.contains('&'));
    }
}

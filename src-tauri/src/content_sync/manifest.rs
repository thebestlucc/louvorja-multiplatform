use serde::Deserialize;
use crate::error::AppError;

const MAX_MANIFEST_BYTES: usize = 1 * 1024 * 1024; // 1 MiB limit for manifest JSON

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPack {
    pub id: String,
    pub url: String,
    pub version: u32,
    pub size: u64,
    // TODO(review): sha256 is currently optional; before using pack ZIPs in production,
    // add integrity verification at the download layer (Task 3/5). Consider making sha256
    // required in a future manifest schema version. - Security Reviewer, 2026-03-19, Severity: Low
    pub sha256: Option<String>,
    pub hymn_ids: Vec<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestUpdate {
    pub id: i64,
    pub audio_cdn_url: Option<String>,
    pub audio_ftp_path: Option<String>,
    pub audio_size: Option<u64>,
    pub playback_cdn_url: Option<String>,
    pub playback_ftp_path: Option<String>,
    pub playback_size: Option<u64>,
    pub cover_cdn_url: Option<String>,
    pub cover_ftp_path: Option<String>,
    pub cover_size: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentManifest {
    pub manifest_version: i64,
    pub db_version: Option<i64>,
    #[serde(default)]
    pub packs: Vec<ManifestPack>,
    #[serde(default)]
    pub updates: Vec<ManifestUpdate>,
}

/// Fetch and deserialize a manifest JSON from a URL.
/// The response may be gzip-compressed — reqwest handles this automatically
/// when the `Content-Encoding: gzip` header is present and the `gzip` feature is enabled.
///
/// # Caller Responsibilities
/// - The `client` MUST be configured with a timeout (e.g., `reqwest::Client::builder().timeout(Duration::from_secs(30))`)
///   to prevent indefinite hangs on slow/stalled CDN responses.
///
/// # Security Notes
/// - Response body is limited to 1 MiB to prevent OOM from malicious servers.
/// - URL validation (HTTPS scheme, hostname allowlist) should be enforced by the caller before
///   passing the URL to this function.
pub async fn fetch_manifest(
    client: &reqwest::Client,
    url: &str,
) -> Result<ContentManifest, AppError> {
    let response = client
        .get(url)
        .header("Accept-Encoding", "gzip")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Manifest fetch failed: {}", e)))?;

    if !response.status().is_success() {
        eprintln!("[manifest] Manifest fetch returned HTTP {} for URL: {}", response.status(), url);
        return Err(AppError::Internal(format!(
            "Manifest fetch returned HTTP {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| AppError::Internal(format!("Manifest read failed: {}", e)))?;

    if bytes.len() > MAX_MANIFEST_BYTES {
        return Err(AppError::Internal(format!(
            "Manifest response too large: {} bytes (limit {} bytes)",
            bytes.len(),
            MAX_MANIFEST_BYTES
        )));
    }

    serde_json::from_slice(&bytes)
        .map_err(|e| AppError::Internal(format!("Manifest parse failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_manifest_with_packs_and_updates() {
        let json = r#"{
            "manifestVersion": 1,
            "dbVersion": 1234,
            "packs": [
                {
                    "id": "album-hinario",
                    "url": "https://example.r2.dev/packs/album-hinario-v2.zip",
                    "version": 2,
                    "size": 52428800,
                    "sha256": null,
                    "hymnIds": [1, 2, 3]
                }
            ],
            "updates": [
                {
                    "id": 1043,
                    "audioCdnUrl": "https://example.r2.dev/updates/1043.mp3",
                    "audioFtpPath": "config/musicas/colecao/1043.mp3",
                    "audioSize": 3456789,
                    "playbackCdnUrl": null,
                    "playbackFtpPath": null,
                    "playbackSize": null,
                    "coverCdnUrl": null,
                    "coverFtpPath": "config/imagens/1043.jpg",
                    "coverSize": 85000
                }
            ]
        }"#;

        let manifest: ContentManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.manifest_version, 1);
        assert_eq!(manifest.packs.len(), 1);
        assert_eq!(manifest.packs[0].id, "album-hinario");
        assert_eq!(manifest.packs[0].version, 2);
        assert_eq!(manifest.packs[0].hymn_ids, vec![1, 2, 3]);
        assert_eq!(manifest.updates.len(), 1);
        assert_eq!(manifest.updates[0].id, 1043);
        assert_eq!(
            manifest.updates[0].audio_cdn_url.as_deref(),
            Some("https://example.r2.dev/updates/1043.mp3")
        );
        assert_eq!(manifest.packs[0].url, "https://example.r2.dev/packs/album-hinario-v2.zip");
        assert_eq!(manifest.packs[0].size, 52428800);
        assert!(manifest.packs[0].sha256.is_none());
        assert_eq!(manifest.updates[0].audio_ftp_path.as_deref(), Some("config/musicas/colecao/1043.mp3"));
        assert_eq!(manifest.updates[0].audio_size, Some(3456789));
        assert_eq!(manifest.updates[0].cover_ftp_path.as_deref(), Some("config/imagens/1043.jpg"));
        assert_eq!(manifest.updates[0].cover_size, Some(85000));
        assert!(manifest.updates[0].playback_cdn_url.is_none());
        assert!(manifest.updates[0].playback_ftp_path.is_none());
        assert_eq!(manifest.db_version, Some(1234));
    }

    #[test]
    fn parse_manifest_minimal_fields() {
        // Test with only required fields (no optional fields)
        let json = r#"{
            "manifestVersion": 1,
            "packs": [],
            "updates": []
        }"#;

        let manifest: ContentManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.manifest_version, 1);
        assert!(manifest.db_version.is_none());
        assert!(manifest.packs.is_empty());
        assert!(manifest.updates.is_empty());
    }

    #[test]
    fn parse_manifest_update_with_all_optional_fields_absent() {
        let json = r#"{
            "manifestVersion": 1,
            "packs": [],
            "updates": [
                {
                    "id": 9999
                }
            ]
        }"#;

        let manifest: ContentManifest = serde_json::from_str(json).unwrap();
        let update = &manifest.updates[0];
        assert_eq!(update.id, 9999);
        assert!(update.audio_cdn_url.is_none());
        assert!(update.audio_ftp_path.is_none());
        assert!(update.audio_size.is_none());
        assert!(update.playback_cdn_url.is_none());
        assert!(update.playback_ftp_path.is_none());
        assert!(update.playback_size.is_none());
        assert!(update.cover_cdn_url.is_none());
        assert!(update.cover_ftp_path.is_none());
        assert!(update.cover_size.is_none());
    }

    #[tokio::test]
    async fn fetch_manifest_returns_err_on_http_error() {
        use wiremock::{MockServer, Mock, ResponseTemplate};
        use wiremock::matchers::method;

        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(404))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let url = server.uri();
        let result = fetch_manifest(&client, &url).await;

        assert!(result.is_err(), "Should return Err on 404");
        let err = result.unwrap_err();
        let err_str = format!("{}", err);
        assert!(err_str.contains("HTTP 404"), "Error should mention HTTP 404, got: {}", err_str);
    }

    #[tokio::test]
    async fn fetch_manifest_returns_err_on_invalid_json() {
        use wiremock::{MockServer, Mock, ResponseTemplate};
        use wiremock::matchers::method;

        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(200).set_body_string("{invalid json"))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let url = server.uri();
        let result = fetch_manifest(&client, &url).await;

        assert!(result.is_err(), "Should return Err on invalid JSON");
        let err = format!("{}", result.unwrap_err());
        assert!(err.contains("parse failed") || err.contains("Manifest"), "Error should mention parse failure, got: {}", err);
    }

    #[tokio::test]
    async fn fetch_manifest_returns_err_on_oversized_response() {
        use wiremock::{MockServer, Mock, ResponseTemplate};
        use wiremock::matchers::method;

        let server = MockServer::start().await;
        let large_body = "x".repeat(2 * 1024 * 1024); // 2 MiB - over the 1 MiB limit
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(200).set_body_string(large_body))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let url = server.uri();
        let result = fetch_manifest(&client, &url).await;

        assert!(result.is_err(), "Should return Err on oversized response");
        let err = format!("{}", result.unwrap_err());
        assert!(err.contains("too large"), "Error should mention size limit, got: {}", err);
    }
}

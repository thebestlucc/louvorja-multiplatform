use serde::{Deserialize, Serialize};
use crate::error::AppError;

const MAX_MANIFEST_BYTES: usize = 1 * 1024 * 1024; // 1 MiB limit for manifest JSON

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFile {
    pub path: String,
    pub hymn_api_id: Option<i64>,
    pub album_api_id: Option<i64>,
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPack {
    pub id: String,
    pub url: String,
    pub version: u32,
    pub size: u64,
    pub sha256: String,
    pub files: Vec<ManifestFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentManifest {
    pub manifest_version: i64,
    pub generated_at: Option<String>,
    #[serde(default)]
    pub packs: Vec<ManifestPack>,
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
    fn parse_manifest_with_pack_files() {
        let json = r#"{
            "manifestVersion": 42,
            "generatedAt": "2026-03-20T15:00:00Z",
            "packs": [
                {
                    "id": "hymnal-pt-001",
                    "url": "https://pub-xxx.r2.dev/packs/hymnal-pt-001-v3.zip",
                    "version": 3,
                    "size": 456000000,
                    "sha256": "e3b0c44298fc1c149afb",
                    "files": [
                        {
                            "path": "media/audio/123/hino123.mp3",
                            "hymnApiId": 123,
                            "albumApiId": null,
                            "type": "audio",
                            "size": 5200000
                        },
                        {
                            "path": "media/images/456/album456.jpg",
                            "hymnApiId": null,
                            "albumApiId": 456,
                            "type": "album_cover",
                            "size": 120000
                        }
                    ]
                }
            ]
        }"#;
        let manifest: ContentManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.manifest_version, 42);
        assert_eq!(manifest.generated_at.as_deref(), Some("2026-03-20T15:00:00Z"));
        assert_eq!(manifest.packs.len(), 1);
        let pack = &manifest.packs[0];
        assert_eq!(pack.id, "hymnal-pt-001");
        assert_eq!(pack.version, 3);
        assert_eq!(pack.sha256, "e3b0c44298fc1c149afb");
        assert_eq!(pack.files.len(), 2);
        assert_eq!(pack.files[0].path, "media/audio/123/hino123.mp3");
        assert_eq!(pack.files[0].hymn_api_id, Some(123));
        assert_eq!(pack.files[0].album_api_id, None);
        assert_eq!(pack.files[0].file_type, "audio");
        assert_eq!(pack.files[1].album_api_id, Some(456));
    }

    #[test]
    fn parse_manifest_minimal() {
        let json = r#"{"manifestVersion": 1}"#;
        let manifest: ContentManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.manifest_version, 1);
        assert!(manifest.generated_at.is_none());
        assert!(manifest.packs.is_empty());
    }

    #[test]
    fn parse_manifest_empty_packs() {
        let json = r#"{"manifestVersion": 1, "packs": []}"#;
        let manifest: ContentManifest = serde_json::from_str(json).unwrap();
        assert!(manifest.packs.is_empty());
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

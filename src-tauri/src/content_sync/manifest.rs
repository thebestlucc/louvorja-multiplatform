use serde::Deserialize;
use crate::error::AppError;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPack {
    pub id: String,
    pub url: String,
    pub version: u32,
    pub size: u64,
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
    pub packs: Vec<ManifestPack>,
    pub updates: Vec<ManifestUpdate>,
}

/// Fetch and deserialize a manifest JSON from a URL.
/// The response may be gzip-compressed — reqwest handles this automatically
/// when the `Content-Encoding: gzip` header is present.
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
        return Err(AppError::Internal(format!(
            "Manifest fetch returned HTTP {}: {}",
            response.status(),
            url
        )));
    }

    let text = response
        .text()
        .await
        .map_err(|e| AppError::Internal(format!("Manifest read failed: {}", e)))?;

    serde_json::from_str(&text)
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
}

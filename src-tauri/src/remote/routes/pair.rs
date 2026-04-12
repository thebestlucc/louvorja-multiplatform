//! HTTP pairing endpoints:
//! - `POST /pair/start`   — optional; returns a hint for PIN fallback
//! - `POST /pair/complete` — verifies token, inserts device, returns device credentials

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

use crate::{
    db::queries::remote as remote_queries,
    remote::{nonce_cache::NonceCache, pairing::PairingSession},
};

/// Shared state injected into axum via `axum::extract::State`.
#[derive(Clone)]
pub struct PairRouteState {
    pub db: r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>,
    pub pairing: Arc<Mutex<Option<PairingSession>>>,
    pub nonce_cache: Arc<Mutex<NonceCache>>,
    /// The server's own name, shown to the pairing device.
    pub server_name: String,
    /// Optional Tauri AppHandle for emitting events and dispatching commands. None in unit tests.
    pub app_handle: Option<tauri::AppHandle>,
    /// Broadcast sender for Tauri → WS fanout. Each WS handler subscribes a receiver.
    pub broadcast_tx: std::sync::Arc<tokio::sync::broadcast::Sender<String>>,
}

// ── Request / response types ──────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairCompleteRequest {
    /// The single-use token from the QR code.
    pub token: Option<String>,
    /// 6-digit PIN fallback.
    pub pin: Option<String>,
    /// Human-readable name the device supplies (e.g. "Pedro's iPhone").
    pub device_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairCompleteResponse {
    pub device_id: String,
    pub device_token: String,
    pub server_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairStartResponse {
    pub hint: String,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// `POST /pair/start` — optional endpoint; mainly used for PIN-fallback UI.
pub async fn pair_start(
    State(state): State<PairRouteState>,
) -> Response {
    let guard = state.pairing.lock().unwrap_or_else(|e| e.into_inner());
    if guard.as_ref().map(|s| s.is_valid()).unwrap_or(false) {
        Json(PairStartResponse { hint: "Pairing window open. Enter pin or scan QR.".into() })
            .into_response()
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "No active pairing session").into_response()
    }
}

/// `POST /pair/complete` — verifies token/pin, registers device, returns credentials.
pub async fn pair_complete(
    State(state): State<PairRouteState>,
    Json(body): Json<PairCompleteRequest>,
) -> Response {
    // 1. Take the current pairing session (under lock).
    let mut pairing_guard = state.pairing.lock().unwrap_or_else(|e| e.into_inner());
    let session = match pairing_guard.as_mut() {
        Some(s) if s.is_valid() => s,
        _ => return (StatusCode::FORBIDDEN, "No active pairing session").into_response(),
    };

    // 2. Verify token or PIN.
    let token_ok = body.token.as_deref().map(|t| t == session.token).unwrap_or(false);
    let pin_ok   = body.pin.as_deref().map(|p| p == session.pin).unwrap_or(false);
    if !token_ok && !pin_ok {
        return (StatusCode::FORBIDDEN, "Invalid token or PIN").into_response();
    }

    // 3. Mark session as used (single-use).
    session.used = true;

    // 4. Generate a new 32-byte random device token.
    use rand::RngCore;
    let mut raw_token = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut raw_token);
    use base64::{Engine, prelude::BASE64_URL_SAFE_NO_PAD};
    let device_token = BASE64_URL_SAFE_NO_PAD.encode(raw_token);

    // 5. Insert device row in DB.
    let conn = match state.db.get() {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let device_id = match remote_queries::insert_device(&conn, &body.device_name, raw_token.as_ref()) {
        Ok(id) => id,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    // 6. Emit events if we have an AppHandle.
    if let Some(ref app) = state.app_handle {
        use tauri::Emitter;
        let _ = app.emit("remote-devices-changed", ());
        let _ = app.emit("remote-pairing-request", serde_json::json!({
            "deviceId": device_id,
            "deviceName": body.device_name,
        }));
    }

    // Release the lock (session is now marked used).
    drop(pairing_guard);

    Json(PairCompleteResponse {
        device_id,
        device_token,
        server_name: state.server_name.clone(),
    })
    .into_response()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::Request,
        routing::post,
        Router,
    };
    use std::time::Duration;
    use tower::ServiceExt;

    fn make_test_db() -> r2d2::Pool<r2d2_sqlite::SqliteConnectionManager> {
        let manager = r2d2_sqlite::SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).unwrap();
        let conn = pool.get().unwrap();
        crate::db::migrations::run_migrations(&conn).unwrap();
        pool
    }

    fn test_state_with_session(token: &str, pin: &str) -> PairRouteState {
        let db = make_test_db();
        let session = PairingSession {
            token: token.to_string(),
            pin: pin.to_string(),
            created: std::time::Instant::now(),
            ttl: Duration::from_secs(120),
            used: false,
        };
        let (tx, _rx) = tokio::sync::broadcast::channel(16);
        PairRouteState {
            db,
            pairing: Arc::new(Mutex::new(Some(session))),
            nonce_cache: Arc::new(Mutex::new(NonceCache::new(100, Duration::from_secs(60)))),
            server_name: "TestServer".into(),
            app_handle: None,
            broadcast_tx: std::sync::Arc::new(tx),
        }
    }

    fn test_app(state: PairRouteState) -> Router {
        Router::new()
            .route("/pair/start", post(pair_start))
            .route("/pair/complete", post(pair_complete))
            .with_state(state)
    }

    #[tokio::test]
    async fn pair_complete_with_valid_token_issues_device_token() {
        let state = test_state_with_session("tok123", "000001");
        let app = test_app(state);

        let req = Request::builder()
            .method("POST")
            .uri("/pair/complete")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({
                    "token": "tok123",
                    "deviceName": "iPhone"
                })
                .to_string(),
            ))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body_bytes = axum::body::to_bytes(resp.into_body(), 65536).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert!(!body["deviceToken"].as_str().unwrap().is_empty());
        assert!(!body["deviceId"].as_str().unwrap().is_empty());
    }

    #[tokio::test]
    async fn pair_complete_replay_fails() {
        let state = test_state_with_session("tok456", "000002");
        // Use the router's shared state via two requests.
        let app = test_app(state);

        let body_json = serde_json::json!({ "token": "tok456", "deviceName": "Android" }).to_string();

        let req1 = Request::builder()
            .method("POST")
            .uri("/pair/complete")
            .header("content-type", "application/json")
            .body(Body::from(body_json.clone()))
            .unwrap();

        let resp1 = app.clone().oneshot(req1).await.unwrap();
        assert_eq!(resp1.status(), StatusCode::OK);

        let req2 = Request::builder()
            .method("POST")
            .uri("/pair/complete")
            .header("content-type", "application/json")
            .body(Body::from(body_json))
            .unwrap();

        let resp2 = app.oneshot(req2).await.unwrap();
        assert_eq!(resp2.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn pair_complete_wrong_token_rejected() {
        let state = test_state_with_session("correct_token", "999999");
        let app = test_app(state);

        let req = Request::builder()
            .method("POST")
            .uri("/pair/complete")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({ "token": "wrong", "deviceName": "BadDevice" }).to_string(),
            ))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn pair_start_with_active_session_returns_200() {
        let state = test_state_with_session("t", "123456");
        let app = test_app(state);

        let req = Request::builder()
            .method("POST")
            .uri("/pair/start")
            .body(Body::empty())
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }
}

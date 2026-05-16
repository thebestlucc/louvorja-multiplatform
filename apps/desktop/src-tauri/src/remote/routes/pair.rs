//! HTTP pairing endpoints:
//! - `POST /pair/start`   — optional; returns a hint for PIN fallback
//! - `POST /pair/complete` — verifies token, inserts device, returns device credentials

use axum::{
    extract::{ConnectInfo, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::{Arc, Mutex}};

use crate::{
    db::queries::remote as remote_queries,
    remote::{
        nonce_cache::NonceCache,
        pairing::PairingSession,
        rate_limit::{PairRateLimiter, SuspiciousHmacTracker},
        state::{ConnectionInfo, PinRateLimiter},
    },
};
use uuid::Uuid;

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
    /// Live presence map: session UUID → ConnectionInfo. Shared with RemoteServerState.
    pub connections: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<Uuid, ConnectionInfo>>>,
    /// Rate limiter for PIN pairing attempts to prevent brute-force attacks.
    pub pin_limiter: Arc<PinRateLimiter>,
    /// H7: IP-based rate limiter for /pair/* endpoints (5 req/min per IP).
    pub pair_rate_limiter: Arc<PairRateLimiter>,
    /// H7: Tracks per-device HMAC failures; emits suspicious event at threshold.
    pub suspicious_tracker: Arc<SuspiciousHmacTracker>,
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

// ── Revoke request ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairRevokeRequest {
    /// The device token (base64url, no padding) to revoke.
    pub device_token: String,
}

/// `POST /pair/revoke` — revokes the calling device's token so the DB entry is
/// soft-deleted.  The device clears its local storage regardless of the response,
/// so failures here are non-fatal on the client side.
pub async fn pair_revoke(
    State(state): State<PairRouteState>,
    Json(body): Json<PairRevokeRequest>,
) -> Response {
    use base64::{Engine, prelude::BASE64_URL_SAFE_NO_PAD};

    let token_bytes = match BASE64_URL_SAFE_NO_PAD.decode(&body.device_token) {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_REQUEST, "Malformed device token").into_response(),
    };

    let conn = match state.db.get() {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let device = match remote_queries::find_by_token_hash(&conn, &token_bytes) {
        Ok(Some(d)) => d,
        _ => return (StatusCode::NOT_FOUND, "Device not found").into_response(),
    };

    if let Err(e) = remote_queries::revoke_device(&conn, &device.id) {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    if let Some(ref app) = state.app_handle {
        use tauri::Emitter;
        let _ = app.emit("remote-devices-changed", ());
    }

    StatusCode::NO_CONTENT.into_response()
}

/// `POST /pair/start` — optional endpoint; mainly used for PIN-fallback UI.
pub async fn pair_start(
    State(state): State<PairRouteState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Response {
    // H7: IP-based rate limit — 5 attempts/min per IP (same budget as pair_complete).
    if !state.pair_rate_limiter.check(addr.ip()) {
        return (StatusCode::TOO_MANY_REQUESTS, "Too many pairing attempts. Try again in 1 minute.").into_response();
    }

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
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(body): Json<PairCompleteRequest>,
) -> Response {
    // H7: IP-based rate limit — 5 attempts/min per IP.
    if !state.pair_rate_limiter.check(addr.ip()) {
        return (StatusCode::TOO_MANY_REQUESTS, "Too many pairing attempts. Try again in 1 minute.").into_response();
    }

    // Rate limit PIN attempts to prevent brute-force attacks.
    if !state.pin_limiter.check() {
        return (StatusCode::TOO_MANY_REQUESTS, "Too many PIN attempts. Wait 5 minutes.").into_response();
    }

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

    // Reset the PIN rate limiter after successful pairing.
    state.pin_limiter.reset();

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
            connections: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
            pin_limiter: Arc::new(PinRateLimiter::new()),
            pair_rate_limiter: std::sync::Arc::new(crate::remote::rate_limit::PairRateLimiter::default()),
            suspicious_tracker: std::sync::Arc::new(crate::remote::rate_limit::SuspiciousHmacTracker::default()),
        }
    }

    fn test_app(state: PairRouteState) -> axum::extract::connect_info::IntoMakeServiceWithConnectInfo<Router, std::net::SocketAddr> {
        Router::new()
            .route("/pair/start", post(pair_start))
            .route("/pair/complete", post(pair_complete))
            .with_state(state)
            .into_make_service_with_connect_info::<std::net::SocketAddr>()
    }

    async fn call_app(
        app: &mut axum::extract::connect_info::IntoMakeServiceWithConnectInfo<Router, std::net::SocketAddr>,
        req: axum::http::Request<axum::body::Body>,
    ) -> axum::response::Response {
        use tower::Service;
        use std::net::SocketAddr;
        let addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();
        let svc = app.call(addr).await.unwrap();
        svc.oneshot(req).await.unwrap()
    }

    #[tokio::test]
    async fn pair_complete_with_valid_token_issues_device_token() {
        let state = test_state_with_session("tok123", "000001");
        let mut app = test_app(state);

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

        let resp = call_app(&mut app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);

        let body_bytes = axum::body::to_bytes(resp.into_body(), 65536).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert!(!body["deviceToken"].as_str().unwrap().is_empty());
        assert!(!body["deviceId"].as_str().unwrap().is_empty());
    }

    #[tokio::test]
    async fn pair_complete_replay_fails() {
        let state = test_state_with_session("tok456", "000002");
        let mut app = test_app(state);

        let body_json = serde_json::json!({ "token": "tok456", "deviceName": "Android" }).to_string();

        let req1 = Request::builder()
            .method("POST")
            .uri("/pair/complete")
            .header("content-type", "application/json")
            .body(Body::from(body_json.clone()))
            .unwrap();

        let resp1 = call_app(&mut app, req1).await;
        assert_eq!(resp1.status(), StatusCode::OK);

        let req2 = Request::builder()
            .method("POST")
            .uri("/pair/complete")
            .header("content-type", "application/json")
            .body(Body::from(body_json))
            .unwrap();

        let resp2 = call_app(&mut app, req2).await;
        assert_eq!(resp2.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn pair_complete_wrong_token_rejected() {
        let state = test_state_with_session("correct_token", "999999");
        let mut app = test_app(state);

        let req = Request::builder()
            .method("POST")
            .uri("/pair/complete")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({ "token": "wrong", "deviceName": "BadDevice" }).to_string(),
            ))
            .unwrap();

        let resp = call_app(&mut app, req).await;
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn pair_start_with_active_session_returns_200() {
        let state = test_state_with_session("t", "123456");
        let mut app = test_app(state);

        let req = Request::builder()
            .method("POST")
            .uri("/pair/start")
            .body(Body::empty())
            .unwrap();

        let resp = call_app(&mut app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn pair_complete_rate_limited_on_sixth_attempt() {
        // H7: limiter capacity=5; 6th request from same IP must return 429.
        let state = test_state_with_session("rate-tok", "111111");
        let mut app = test_app(state);

        let body = serde_json::json!({ "token": "rate-tok", "deviceName": "RateTest" }).to_string();

        // First 5 requests — consumed by token bucket.
        // Request 1 should succeed (valid token, first attempt).
        // Requests 2–5 will fail FORBIDDEN (token used after first success), but
        // that's fine — we just need to consume the rate-limit bucket.
        // Actually the bucket is checked BEFORE session validation, so requests
        // 2-5 hit session-invalid (FORBIDDEN) but still consume a token.
        for _ in 0..5 {
            let req = Request::builder()
                .method("POST")
                .uri("/pair/complete")
                .header("content-type", "application/json")
                .body(Body::from(body.clone()))
                .unwrap();
            let _ = call_app(&mut app, req).await; // consume token, ignore result
        }

        // 6th request must be rate-limited.
        let req6 = Request::builder()
            .method("POST")
            .uri("/pair/complete")
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();
        let resp6 = call_app(&mut app, req6).await;
        assert_eq!(resp6.status(), StatusCode::TOO_MANY_REQUESTS, "6th request should be 429");
    }
}

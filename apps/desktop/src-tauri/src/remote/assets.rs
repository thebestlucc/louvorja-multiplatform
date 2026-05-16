//! Static asset serving for the remote PWA.
//!
//! The entire `remote-pwa/dist/` directory is embedded at compile time using
//! `include_dir!`. This means you MUST run `pnpm --filter remote-pwa build`
//! before `cargo build`. A `build.rs` check enforces this.
//!
//! SPA routing: any unknown path falls back to `/index.html` so that
//! TanStack Router can handle client-side navigation (e.g. `/pair`, `/live`).

use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use include_dir::{include_dir, Dir};

/// The compiled-in PWA bundle. Path is relative to `src-tauri/Cargo.toml`.
static PWA: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/../../remote-pwa/dist");

/// Maps file extensions to MIME types.
fn mime_for_path(path: &str) -> &'static str {
    let ext = path.rsplit('.').next().unwrap_or("");
    match ext {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "webmanifest" => "application/json; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml; charset=utf-8",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

/// Serve a static file from the embedded PWA bundle.
///
/// Path resolution:
/// 1. Try the exact URI path (strip leading `/`).
/// 2. Try `<path>/index.html` (directory index).
/// 3. Fall back to `/index.html` (SPA catch-all for client-side routes).
pub async fn serve_static(uri: Uri) -> Response {
    let req_path = uri.path().trim_start_matches('/');

    // 1. Exact match
    if let Some(file) = PWA.get_file(req_path) {
        let mime = mime_for_path(req_path);
        let body = Body::from(file.contents());
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            // Cache hashed assets aggressively; index.html must not be cached
            .header(
                header::CACHE_CONTROL,
                if req_path.contains("/assets/") {
                    "public, max-age=31536000, immutable"
                } else {
                    "no-cache"
                },
            )
            .body(body)
            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
    }

    // 2. Directory index
    let index_path = format!("{}/index.html", req_path.trim_end_matches('/'));
    if let Some(file) = PWA.get_file(index_path.trim_start_matches('/')) {
        let body = Body::from(file.contents());
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
            .header(header::CACHE_CONTROL, "no-cache")
            .body(body)
            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
    }

    // 3. SPA fallback → index.html
    if let Some(file) = PWA.get_file("index.html") {
        let body = Body::from(file.contents());
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
            .header(header::CACHE_CONTROL, "no-cache")
            .body(body)
            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
    }

    // PWA not built yet
    StatusCode::NOT_FOUND.into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mime_for_js_returns_javascript() {
        assert_eq!(mime_for_path("assets/main.abc123.js"), "application/javascript; charset=utf-8");
    }

    #[test]
    fn mime_for_html_returns_html() {
        assert_eq!(mime_for_path("index.html"), "text/html; charset=utf-8");
    }

    #[test]
    fn mime_for_webmanifest_returns_json() {
        assert_eq!(mime_for_path("manifest.webmanifest"), "application/json; charset=utf-8");
    }

    #[test]
    fn mime_for_unknown_returns_octet_stream() {
        assert_eq!(mime_for_path("data.bin"), "application/octet-stream");
    }

    #[test]
    fn pwa_bundle_contains_index_html() {
        // This test only passes when `pnpm --filter remote-pwa build` has been run.
        assert!(
            PWA.get_file("index.html").is_some(),
            "remote-pwa/dist/index.html not found — run `pnpm --filter remote-pwa build` first"
        );
    }

    #[test]
    fn pwa_bundle_contains_sw_js() {
        assert!(
            PWA.get_file("sw.js").is_some(),
            "remote-pwa/dist/sw.js not found — PWA service worker missing"
        );
    }
}

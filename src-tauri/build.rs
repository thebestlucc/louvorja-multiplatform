fn main() {
    // CDN_MANIFEST_URL: passed at build time, read in Rust via env!("CDN_MANIFEST_URL")
    // In dev: read from .env file at repo root. In CI: set as GitHub Actions secret.
    if let Ok(url) = std::env::var("CDN_MANIFEST_URL") {
        println!("cargo:rustc-env=CDN_MANIFEST_URL={}", url);
    } else {
        // Fallback for dev when .env is missing — feature is silently disabled
        println!("cargo:rustc-env=CDN_MANIFEST_URL=");
    }

    tauri_build::build()
}

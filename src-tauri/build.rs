fn main() {
    // Load .env from the repo root (one level up from src-tauri/).
    // In CI the variable is set directly in the environment, so this is a no-op there.
    let repo_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let env_path = repo_root.join(".env");
    let _ = dotenvy::from_path(&env_path);

    // Re-run build.rs whenever .env changes (or appears/disappears) so the
    // baked-in CDN_MANIFEST_URL stays in sync with the file on disk.
    println!("cargo:rerun-if-changed={}", env_path.display());
    println!("cargo:rerun-if-env-changed=CDN_MANIFEST_URL");

    // CDN_MANIFEST_URL: baked into the binary at compile time.
    // Empty string → pack sync silently disabled (dev without .env configured).
    if let Ok(url) = std::env::var("CDN_MANIFEST_URL") {
        println!("cargo:rustc-env=CDN_MANIFEST_URL={}", url);
    } else {
        println!("cargo:rustc-env=CDN_MANIFEST_URL=");
    }

    tauri_build::build()
}

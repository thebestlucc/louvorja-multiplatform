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

    // remote-pwa/dist is embedded via `include_dir!` in src/remote/assets.rs.
    // `include_dir!` does NOT emit rerun hints, so without this watcher the
    // Rust binary keeps a stale PWA bundle after a `pnpm --filter remote-pwa
    // build`. Walk the dist tree and declare every file as a rerun dependency.
    let pwa_dist = repo_root.join("remote-pwa").join("dist");
    fn emit_rerun_recursive(path: &std::path::Path) {
        if path.is_dir() {
            println!("cargo:rerun-if-changed={}", path.display());
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.flatten() {
                    emit_rerun_recursive(&entry.path());
                }
            }
        } else {
            println!("cargo:rerun-if-changed={}", path.display());
        }
    }
    if pwa_dist.exists() {
        emit_rerun_recursive(&pwa_dist);
    }

    // CDN_MANIFEST_URL: baked into the binary at compile time.
    // Empty string → pack sync silently disabled (dev without .env configured).
    if let Ok(url) = std::env::var("CDN_MANIFEST_URL") {
        println!("cargo:rustc-env=CDN_MANIFEST_URL={}", url);
    } else {
        println!("cargo:rustc-env=CDN_MANIFEST_URL=");
    }

    // ─── GStreamer dylib bundling (stub — implemented in Task 5 of Rust video pipeline plan) ─────
    // For dev builds, the system GStreamer (Homebrew on macOS, MSVC installer on Windows,
    // apt packages on Linux) is linked at compile time via pkg-config. No copy needed.
    // For release/distribution builds, native dylibs/DLLs must be bundled into the .app/.exe
    // and GST_PLUGIN_PATH set at runtime. See docs/plans/2026-04-17-rust-video-pipeline.md
    // Task 5.x for the bundling implementation.
    // TODO(Task 5): copy GStreamer plugins on cfg(target_os = "macos"|"windows") release builds.

    tauri_build::build()
}

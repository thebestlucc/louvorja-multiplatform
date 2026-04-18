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

    // ─── GStreamer runtime bundling (Phase 5 — release builds only) ─────────
    //
    // The Rust video pipeline (gstreamer-rs) links against GStreamer at compile
    // time via pkg-config. In dev the system install is used at runtime too,
    // but distributed builds cannot assume end-users have GStreamer installed,
    // so we vendor the plugin directory + core dylibs/DLLs next to the app.
    //
    // Output layout (written by this script into
    //   `<manifest_dir>/gstreamer-runtime/`,
    // which is declared in tauri.conf.json `bundle.resources`):
    //
    //   gstreamer-runtime/
    //     gstreamer-1.0/     # plugin .dylib / .dll files (element factories)
    //     lib/               # core libgst*.dylib / core DLLs (macOS only;
    //                        #  Windows puts these next to the exe via `bin/`)
    //
    // At runtime `lib.rs` setup() sets `GST_PLUGIN_PATH` to the bundled
    // `gstreamer-1.0/` directory BEFORE gst::init() runs, so the embedded
    // plugins are picked up instead of system ones.
    //
    // .gitignore excludes `src-tauri/gstreamer-runtime/`.
    //
    // Dev builds (debug) skip bundling: the system install works fine for
    // `pnpm tauri dev` and plain `cargo build`.
    let profile = std::env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let is_release = profile == "release";
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let runtime_dir = manifest_dir.join("gstreamer-runtime");

    // Tauri validates `bundle.resources` globs at build time even in dev. If
    // `gstreamer-runtime/` is empty the glob prints a noisy warning. Drop a
    // `.gitkeep` so the glob resolves to at least one file in every build.
    if let Err(e) = ensure_runtime_dir_placeholder(&runtime_dir) {
        println!(
            "cargo:warning=Failed to prepare {}: {e}",
            runtime_dir.display()
        );
    }

    if is_release {
        #[cfg(target_os = "macos")]
        bundle_gstreamer_macos(&runtime_dir);
        #[cfg(target_os = "windows")]
        bundle_gstreamer_windows(&runtime_dir);
        // Linux: not bundled here. AppImage relies on system packages; deb/rpm
        // declare gstreamer1.0-* package dependencies. README documents the
        // required apt/dnf packages for end users.
    }

    tauri_build::build()
}

/// Create `<runtime_dir>/.gitkeep` so `bundle.resources` globs always match
/// (empty dirs trigger a noisy `glob pattern ... didn't match any files`
/// warning on every `cargo build`). The file is harmless in the bundle.
fn ensure_runtime_dir_placeholder(runtime_dir: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(runtime_dir)?;
    let marker = runtime_dir.join(".gitkeep");
    if !marker.exists() {
        std::fs::write(&marker, b"")?;
    }
    Ok(())
}

/// macOS: locate GStreamer and copy plugins + core dylibs into `runtime_dir`.
///
/// The plan (docs/plans/2026-04-17-rust-video-pipeline.md) assumes the
/// official framework at `/Library/Frameworks/GStreamer.framework/`, but the
/// dev machine uses Homebrew. This function probes BOTH, in this order:
///
///   1. `$GSTREAMER_1_0_ROOT` env var (user/CI override)
///   2. `/Library/Frameworks/GStreamer.framework/Versions/1.0` (official)
///   3. `/opt/homebrew` (Apple Silicon Homebrew prefix)
///   4. `/usr/local` (Intel Homebrew prefix)
///
/// A valid prefix must expose `<prefix>/lib/gstreamer-1.0/` with *.dylib
/// plugin files AND `<prefix>/lib/libgst*.dylib` core libraries.
///
/// Codesigning note: bundled dylibs must be re-signed with the app's identity
/// AFTER `tauri build` produces the .app. This is NOT automated here because
/// it requires Apple Developer identity + keychain access env vars that only
/// the CI release workflow has. Do it in a post-bundle hook, e.g.:
///
///   codesign --deep --force --sign "$APPLE_SIGNING_IDENTITY" \
///       --options runtime --timestamp target/release/bundle/macos/LouvorJA.app
///
/// See `.github/workflows/` for the actual signing step.
#[cfg(target_os = "macos")]
fn bundle_gstreamer_macos(runtime_dir: &std::path::Path) {
    let prefix = match detect_gstreamer_prefix_macos() {
        Some(p) => p,
        None => {
            println!(
                "cargo:warning=GStreamer not found (checked GSTREAMER_1_0_ROOT, \
                 /Library/Frameworks/GStreamer.framework, /opt/homebrew, /usr/local). \
                 Release .app will NOT contain GStreamer; playback will fail on \
                 machines without a system install."
            );
            return;
        }
    };
    println!(
        "cargo:warning=Bundling GStreamer runtime from {} (release build)",
        prefix.display()
    );

    let plugin_src = prefix.join("lib").join("gstreamer-1.0");
    let lib_src = prefix.join("lib");
    let plugin_dst = runtime_dir.join("gstreamer-1.0");
    let lib_dst = runtime_dir.join("lib");

    // Re-run if the source dirs change so rebuilds pick up upgraded GStreamer.
    println!("cargo:rerun-if-changed={}", plugin_src.display());
    println!("cargo:rerun-if-env-changed=GSTREAMER_1_0_ROOT");

    if let Err(e) = recreate_dir(&plugin_dst) {
        println!("cargo:warning=Failed to prepare {}: {e}", plugin_dst.display());
        return;
    }
    if let Err(e) = recreate_dir(&lib_dst) {
        println!("cargo:warning=Failed to prepare {}: {e}", lib_dst.display());
        return;
    }

    // 1) All plugins — do not filter. Trimming is a Phase 6 optimization.
    let plugin_count = copy_dylibs_matching(&plugin_src, &plugin_dst, "", ".dylib");
    // 2) Core libs: libgst*.dylib directly under <prefix>/lib/ (libgstreamer-1.0,
    //    libgstbase-1.0, libgstapp-1.0, libgstvideo-1.0, libgstaudio-1.0, etc.)
    let core_count = copy_dylibs_matching(&lib_src, &lib_dst, "libgst", ".dylib");

    if plugin_count == 0 {
        println!(
            "cargo:warning=No GStreamer plugins found at {} — bundled runtime will be empty",
            plugin_src.display()
        );
    }
    if core_count == 0 {
        println!(
            "cargo:warning=No GStreamer core dylibs (libgst*.dylib) found at {}",
            lib_src.display()
        );
    }
}

/// Detection order documented in `bundle_gstreamer_macos`.
#[cfg(target_os = "macos")]
fn detect_gstreamer_prefix_macos() -> Option<std::path::PathBuf> {
    let probe = |p: std::path::PathBuf| {
        if p.join("lib").join("gstreamer-1.0").is_dir() {
            Some(p)
        } else {
            None
        }
    };
    if let Ok(env_root) = std::env::var("GSTREAMER_1_0_ROOT") {
        if let Some(p) = probe(std::path::PathBuf::from(env_root)) {
            return Some(p);
        }
    }
    // Official framework: `/Library/Frameworks/GStreamer.framework/Versions/1.0`
    if let Some(p) = probe(std::path::PathBuf::from(
        "/Library/Frameworks/GStreamer.framework/Versions/1.0",
    )) {
        return Some(p);
    }
    // Apple Silicon Homebrew
    if let Some(p) = probe(std::path::PathBuf::from("/opt/homebrew")) {
        return Some(p);
    }
    // Intel Homebrew
    if let Some(p) = probe(std::path::PathBuf::from("/usr/local")) {
        return Some(p);
    }
    None
}

/// Windows: expects `GSTREAMER_1_0_ROOT_MSVC_X86_64` to be set by the
/// official MSVC installer. Copies `bin/*.dll` (core libs) and
/// `lib/gstreamer-1.0/*.dll` (plugins) into `runtime_dir`.
///
/// Unverifiable locally from macOS — needs CI verification.
#[cfg(target_os = "windows")]
fn bundle_gstreamer_windows(runtime_dir: &std::path::Path) {
    let prefix = match std::env::var("GSTREAMER_1_0_ROOT_MSVC_X86_64") {
        Ok(v) if !v.is_empty() => std::path::PathBuf::from(v),
        _ => {
            println!(
                "cargo:warning=GSTREAMER_1_0_ROOT_MSVC_X86_64 unset. Windows DLLs \
                 will NOT be bundled. Install the official MSVC GStreamer runtime \
                 + development packages and set the env var before `cargo build --release`."
            );
            return;
        }
    };
    println!(
        "cargo:warning=Bundling GStreamer runtime from {} (release build)",
        prefix.display()
    );
    println!("cargo:rerun-if-env-changed=GSTREAMER_1_0_ROOT_MSVC_X86_64");

    let bin_src = prefix.join("bin");
    let plugin_src = prefix.join("lib").join("gstreamer-1.0");
    let plugin_dst = runtime_dir.join("gstreamer-1.0");
    // Core DLLs go in a `bin/` subdir; lib.rs puts plugin path on GST_PLUGIN_PATH
    // and Tauri bundles all files beside the exe, so Windows DLL search finds
    // core libs automatically (same-directory-as-exe rule).
    let bin_dst = runtime_dir.join("bin");

    if let Err(e) = recreate_dir(&plugin_dst) {
        println!("cargo:warning=Failed to prepare {}: {e}", plugin_dst.display());
        return;
    }
    if let Err(e) = recreate_dir(&bin_dst) {
        println!("cargo:warning=Failed to prepare {}: {e}", bin_dst.display());
        return;
    }

    let plugin_count = copy_dylibs_matching(&plugin_src, &plugin_dst, "", ".dll");
    let bin_count = copy_dylibs_matching(&bin_src, &bin_dst, "", ".dll");

    if plugin_count == 0 {
        println!(
            "cargo:warning=No GStreamer plugins found at {}",
            plugin_src.display()
        );
    }
    if bin_count == 0 {
        println!(
            "cargo:warning=No GStreamer core DLLs found at {}",
            bin_src.display()
        );
    }
}

/// Remove and recreate `dst` so stale files from a prior GStreamer version
/// cannot leak into the new bundle.
#[cfg_attr(not(any(target_os = "macos", target_os = "windows")), allow(dead_code))]
fn recreate_dir(dst: &std::path::Path) -> std::io::Result<()> {
    if dst.exists() {
        std::fs::remove_dir_all(dst)?;
    }
    std::fs::create_dir_all(dst)
}

/// Copy every file in `src` whose name starts with `prefix_filter` and ends
/// with `ext` into `dst`. Returns the count. Non-fatal on individual errors —
/// logs a `cargo:warning` and continues so a single bad symlink doesn't abort
/// the whole build.
#[cfg_attr(not(any(target_os = "macos", target_os = "windows")), allow(dead_code))]
fn copy_dylibs_matching(
    src: &std::path::Path,
    dst: &std::path::Path,
    prefix_filter: &str,
    ext: &str,
) -> usize {
    let entries = match std::fs::read_dir(src) {
        Ok(e) => e,
        Err(e) => {
            println!("cargo:warning=Cannot read {}: {e}", src.display());
            return 0;
        }
    };
    let mut count = 0usize;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if !prefix_filter.is_empty() && !name.starts_with(prefix_filter) {
            continue;
        }
        if !name.ends_with(ext) {
            continue;
        }
        let target = dst.join(name);
        match std::fs::copy(&path, &target) {
            Ok(_) => count += 1,
            Err(e) => println!(
                "cargo:warning=Failed to copy {} -> {}: {e}",
                path.display(),
                target.display()
            ),
        }
    }
    count
}

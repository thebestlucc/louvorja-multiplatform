/**
 * generate-bible-db.mjs — Runs the build_bible binary to produce bible.db.
 *
 * Used as Tauri's beforeBundleCommand so that bible.db is generated AFTER
 * cargo finishes compiling (deps already built) and BEFORE the bundler
 * packages the app.
 *
 * Detects the cargo --target used by the preceding `tauri build` step so
 * that `cargo run` reuses already-compiled deps instead of recompiling.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const platform = process.env.TAURI_ENV_PLATFORM;
const arch = process.env.TAURI_ENV_ARCH;

// Cross-compilation targets where tauri build uses --target and deps live
// in target/<triple>/release/ instead of target/release/.
const CROSS_TARGETS = {
  "macos:aarch64": "aarch64-apple-darwin",
  "macos:x86_64": "x86_64-apple-darwin",
  "windows:x86": "i686-pc-windows-msvc",
};

const targetArgs = [];
const triple = CROSS_TARGETS[`${platform}:${arch}`];

if (triple && existsSync(join("src-tauri", "target", triple, "release"))) {
  targetArgs.push("--target", triple);
}

const cmd = [
  "cargo", "run", "--release", "--bin", "build_bible",
  ...targetArgs,
  "--manifest-path", "src-tauri/Cargo.toml",
].join(" ");

console.log(`[generate-bible-db] ${cmd}`);
execSync(cmd, { stdio: "inherit" });

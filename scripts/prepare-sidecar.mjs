import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const release = process.argv.includes("--release");
const manifestPath = join(root, "src-tauri", "Cargo.toml");
const requestedTargetTriple = process.env.SIDE_CAR_TARGET_TRIPLE?.trim();

const rustc = spawnSync("rustc", ["-vV"], {
  cwd: root,
  encoding: "utf8",
});

if (rustc.status !== 0) {
  process.stderr.write(rustc.stderr || "Failed to detect Rust target triple.\n");
  process.exit(rustc.status ?? 1);
}

const hostLine = rustc.stdout
  .split("\n")
  .find((line) => line.startsWith("host: "));

if (!hostLine) {
  process.stderr.write("Unable to parse host target triple from `rustc -vV`.\n");
  process.exit(1);
}

const hostTriple = hostLine.replace("host: ", "").trim();
const targetTriple = requestedTargetTriple || hostTriple;
const isWindowsTarget = targetTriple.includes("windows");
const executableName = isWindowsTarget ? "presentation-bridge.exe" : "presentation-bridge";
const stagedName = isWindowsTarget
  ? `presentation-bridge-${targetTriple}.exe`
  : `presentation-bridge-${targetTriple}`;

const cargoArgs = [
  "build",
  "--manifest-path",
  manifestPath,
  "--bin",
  "presentation-bridge",
];

if (release) {
  cargoArgs.push("--release");
}

if (targetTriple !== hostTriple) {
  cargoArgs.push("--target", targetTriple);
}

const profileDir = release ? "release" : "debug";
const builtBinary = targetTriple === hostTriple
  ? join(root, "src-tauri", "target", profileDir, executableName)
  : join(root, "src-tauri", "target", targetTriple, profileDir, executableName);
const binariesDir = join(root, "src-tauri", "binaries");
const stagedBinary = join(binariesDir, stagedName);

mkdirSync(binariesDir, { recursive: true });

// Tauri validates externalBin existence during Cargo build script execution.
// Seed an empty placeholder first so the sidecar build can proceed.
if (!existsSync(stagedBinary)) {
  writeFileSync(stagedBinary, "");
}

const cargo = spawnSync("cargo", cargoArgs, {
  cwd: root,
  stdio: "inherit",
});

if (cargo.status !== 0) {
  process.exit(cargo.status ?? 1);
}
copyFileSync(builtBinary, stagedBinary);
process.stdout.write(`Prepared sidecar for ${targetTriple}: ${stagedBinary}\n`);

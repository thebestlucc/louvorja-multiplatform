#!/usr/bin/env node
// Verifies that every command registered in tauri_specta::collect_commands!
// in src-tauri/src/lib.rs is also declared in src-tauri/permissions/commands.toml.
// Missing entries cause "command not allowed" at runtime even when the command compiled.
//
// Usage: node .github/scripts/check-commands-toml.mjs
// Exit 0 = clean. Exit 1 = drift detected.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LIB_RS = resolve(ROOT, "apps/desktop/src-tauri/src/lib.rs");
const COMMANDS_TOML = resolve(ROOT, "apps/desktop/src-tauri/permissions/commands.toml");

// --- Parse collect_commands! block from lib.rs ---
const libSrc = readFileSync(LIB_RS, "utf8");

// Capture everything inside tauri_specta::collect_commands![...]
const collectMatch = libSrc.match(
  /tauri_specta::collect_commands!\s*\[([\s\S]*?)\]\s*\)/
);
if (!collectMatch) {
  console.error("ERROR: Could not find tauri_specta::collect_commands![...] in lib.rs");
  process.exit(1);
}

const collectBlock = collectMatch[1];
// Each entry looks like: commands::module::fn_name,
const collectCommands = new Set(
  [...collectBlock.matchAll(/commands::\w+::(\w+)/g)].map((m) => m[1])
);

// --- Parse allow = [...] arrays from commands.toml ---
// Only look inside `allow = [...]` array bodies to avoid picking up
// permission identifier strings or description strings.
const tomlSrc = readFileSync(COMMANDS_TOML, "utf8");
const tomlCommands = new Set();
const allowBlockRe = /\ballow\s*=\s*\[([\s\S]*?)\]/g;
let blockMatch;
while ((blockMatch = allowBlockRe.exec(tomlSrc)) !== null) {
  const block = blockMatch[1];
  for (const m of block.matchAll(/"([^"]+)"/g)) {
    tomlCommands.add(m[1]);
  }
}

// --- Diff ---
const missingInToml = [...collectCommands].filter((c) => !tomlCommands.has(c));
const deadInToml = [...tomlCommands].filter((c) => !collectCommands.has(c));

let exitCode = 0;

if (missingInToml.length > 0) {
  console.error(
    `\nERROR: ${missingInToml.length} command(s) registered in collect_commands! ` +
      `but MISSING from permissions/commands.toml (will fail at runtime):\n`
  );
  for (const cmd of missingInToml) {
    console.error(`  - ${cmd}`);
  }
  exitCode = 1;
} else {
  console.log("OK: all collect_commands! entries are present in commands.toml");
}

if (deadInToml.length > 0) {
  console.warn(
    `\nWARN: ${deadInToml.length} command(s) in commands.toml not found in collect_commands! (dead permission entries):\n`
  );
  for (const cmd of deadInToml) {
    console.warn(`  - ${cmd}`);
  }
  // Warn-only — dead entries don't break runtime
}

process.exit(exitCode);

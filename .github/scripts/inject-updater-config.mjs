import fs from "node:fs";

const endpoint = process.env.TAURI_UPDATER_ENDPOINT?.trim();
const pubkey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();

if (!endpoint) {
  throw new Error("TAURI_UPDATER_ENDPOINT is required.");
}
if (!pubkey) {
  throw new Error("TAURI_UPDATER_PUBLIC_KEY is required.");
}

const configPath = "src-tauri/tauri.conf.json";
const raw = fs.readFileSync(configPath, "utf8");
const json = JSON.parse(raw);

json.plugins ??= {};
json.plugins.updater ??= {};
json.plugins.updater.active = true;
json.plugins.updater.endpoints = [endpoint];
json.plugins.updater.pubkey = pubkey;

fs.writeFileSync(configPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
console.log("Updater configuration injected into src-tauri/tauri.conf.json");

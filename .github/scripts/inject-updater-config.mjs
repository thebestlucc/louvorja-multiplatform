import fs from "node:fs";

const endpoint = process.env.TAURI_UPDATER_ENDPOINT?.trim();
const pubkey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();

const configPath = "src-tauri/tauri.conf.json";
const raw = fs.readFileSync(configPath, "utf8");
const json = JSON.parse(raw);

json.plugins ??= {};
json.bundle ??= {};

if (endpoint && pubkey) {
  json.plugins.updater = { active: true, endpoints: [endpoint], pubkey };
  json.bundle.createUpdaterArtifacts = true;
  console.log("Updater configuration injected into src-tauri/tauri.conf.json");
} else {
  json.plugins.updater = { active: false, endpoints: [], pubkey: "" };
  json.bundle.createUpdaterArtifacts = false;
  console.log(
    "TAURI_UPDATER_ENDPOINT or TAURI_UPDATER_PUBLIC_KEY not set — updater disabled for this build."
  );
}

fs.writeFileSync(configPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
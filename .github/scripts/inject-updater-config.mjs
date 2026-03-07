import fs from "node:fs";
import path from "node:path";

const endpoint = process.env.TAURI_UPDATER_ENDPOINT?.trim();
const pubkey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
const skipFrontendBuild = process.env.TAURI_SKIP_FRONTEND_BUILD?.trim() === "true";

const configPath = "src-tauri/tauri.conf.json";
const raw = fs.readFileSync(configPath, "utf8");
const json = JSON.parse(raw);

json.plugins ??= {};
json.bundle ??= {};
json.build ??= {};

if (skipFrontendBuild) {
  const frontendDist = json.build.frontendDist ?? "../dist";
  const resolvedFrontendDist = path.resolve(path.dirname(configPath), frontendDist);

  if (!fs.existsSync(resolvedFrontendDist)) {
    throw new Error(
      `TAURI_SKIP_FRONTEND_BUILD=true but no frontendDist was found at ${resolvedFrontendDist}`
    );
  }

  delete json.build.beforeBuildCommand;
  console.log(`Using prebuilt frontend assets from ${frontendDist}`);
}

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

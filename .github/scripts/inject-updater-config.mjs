import fs from "node:fs";
import path from "node:path";

const endpoint = process.env.TAURI_UPDATER_ENDPOINT?.trim();
const pubkey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
const skipFrontendBuild = process.env.TAURI_SKIP_FRONTEND_BUILD?.trim() === "true";

const configPath = "apps/desktop/src-tauri/tauri.conf.json";
const raw = fs.readFileSync(configPath, "utf8");
const json = JSON.parse(raw);

json.plugins ??= {};
json.bundle ??= {};
json.build ??= {};

if (skipFrontendBuild) {
  const frontendDist = json.build.frontendDist ?? "../dist";
  const resolvedFrontendDist = path.resolve(path.dirname(configPath), frontendDist);
  const frontendDistCandidates = [
    resolvedFrontendDist,
    path.join(resolvedFrontendDist, "dist"),
    path.join(resolvedFrontendDist, "frontend-dist"),
    path.join(resolvedFrontendDist, "frontend-dist", "dist"),
    path.resolve("frontend-dist"),
    path.resolve("frontend-dist", "dist"),
  ];

  const availableFrontendDist = frontendDistCandidates.find((candidate) => {
    if (!fs.existsSync(candidate)) {
      return false;
    }

    return fs.existsSync(path.join(candidate, "index.html"));
  });

  if (!availableFrontendDist) {
    throw new Error(
      `TAURI_SKIP_FRONTEND_BUILD=true but no frontendDist was found. Checked: ${frontendDistCandidates.join(", ")}`
    );
  }

  if (availableFrontendDist !== resolvedFrontendDist) {
    fs.mkdirSync(resolvedFrontendDist, { recursive: true });
    fs.cpSync(availableFrontendDist, resolvedFrontendDist, {
      recursive: true,
      force: true,
    });
    console.log(
      `Normalized prebuilt frontend assets from ${path.relative(process.cwd(), availableFrontendDist)} to ${frontendDist}`
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

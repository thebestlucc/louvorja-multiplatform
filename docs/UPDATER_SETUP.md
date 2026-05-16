# Updater Setup

## Where to configure

1. Local/default updater placeholders:
- `apps/desktop/src-tauri/tauri.conf.json`
  - `plugins.updater.endpoints`
  - `plugins.updater.pubkey`

2. CI production secrets (GitHub repository settings):
- `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`
- Required secrets used by release workflow:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - `TAURI_UPDATER_ENDPOINT`
  - `TAURI_UPDATER_PUBLIC_KEY`

3. Release workflow wiring:
- `.github/workflows/release.yml`
- The workflow injects endpoint and public key into `apps/desktop/src-tauri/tauri.conf.json` via:
  - `.github/scripts/inject-updater-config.mjs`

## Notes

- Never commit private signing keys.
- Public key (`pubkey`) is safe to ship in app config.
- For local testing, you can set a test endpoint/pubkey directly in `apps/desktop/src-tauri/tauri.conf.json`.

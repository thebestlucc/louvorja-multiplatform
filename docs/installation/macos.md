# Installing LouvorJA on macOS

## Download

1. Go to the [Releases page](https://github.com/nickksoares/louvorja-multiplataform/releases) and download the `.dmg` file.
   - Both Apple Silicon (M1/M2/M3/M4) and Intel Macs are supported — the correct version is selected automatically based on your chip.

## Install

2. Open the downloaded `.dmg` file.

3. Drag the **LouvorJA** icon into the **Applications** folder.

4. Open **LouvorJA** from your Applications folder (or Launchpad).

5. **If you see "LouvorJA cannot be opened because it is from an unidentified developer":**
   - This is normal until code signing is set up. Your download is safe.
   - Open **System Settings** → **Privacy & Security**
   - Scroll down and click **"Open Anyway"** next to the LouvorJA message
   - Click **"Open"** in the confirmation dialog

## First launch

6. Select your preferred language (Portuguese, English, or Spanish).

7. Choose **"Start fresh"** or **"Import from Delphi version"** if you have an existing database.

## Verify your installation

8. Check the version number in the bottom status bar (e.g., `v0.1.0`).

## Automatic updates

LouvorJA checks for updates automatically. When a new version is available, a notification will appear at the bottom-right corner. During a worship service, the notification is held until the service ends — so your projection is never interrupted.

## Troubleshooting

- **"App is damaged" error:** Open Terminal and run: `xattr -cr /Applications/LouvorJA.app`, then try opening again.
- **App won't start:** Make sure you have macOS 11 (Big Sur) or later.
- **Need help?** Open an issue at [github.com/nickksoares/louvorja-multiplataform/issues](https://github.com/nickksoares/louvorja-multiplataform/issues).

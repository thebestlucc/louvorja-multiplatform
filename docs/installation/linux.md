# Installing LouvorJA on Linux

## Option A: AppImage (recommended — works on any distribution)

### Download

1. Go to the [Releases page](https://github.com/nickksoares/louvorja-multiplataform/releases) and download the `.AppImage` file.

### Install

2. Make the file executable:
   - **File manager:** Right-click the file → Properties → Permissions → check "Allow executing as program"
   - **Terminal:** `chmod +x LouvorJA_0.1.0_amd64.AppImage`

3. Double-click the AppImage to run it.

4. **If nothing happens**, install the required system libraries:
   ```bash
   sudo apt install libwebkit2gtk-4.1-0 libappindicator3-1
   ```

### First launch

5. Select your preferred language (Portuguese, English, or Spanish).

6. Choose **"Start fresh"** or **"Import from Delphi version"** if you have an existing database.

---

## Option B: Debian/Ubuntu (.deb package)

### Download

1. Go to the [Releases page](https://github.com/nickksoares/louvorja-multiplataform/releases) and download the `.deb` file.

### Install

2. Install with one of these methods:
   - **Double-click** the `.deb` file to open it in Software Center, then click "Install"
   - **Terminal:** `sudo dpkg -i LouvorJA_0.1.0_amd64.deb`

3. If you see dependency errors in the terminal:
   ```bash
   sudo apt-get install -f
   ```

4. Launch **LouvorJA** from your application menu.

---

## Verify your installation

7. Open the app and check the version number in the bottom status bar (e.g., `v0.1.0`).

## Automatic updates

LouvorJA checks for updates automatically. When a new version is available, a notification will appear at the bottom-right corner. During a worship service, the notification is held until the service ends — so your projection is never interrupted.

## Troubleshooting

- **AppImage won't run:** Make sure it's executable (`chmod +x`) and that FUSE is installed: `sudo apt install libfuse2`.
- **Missing libraries:** Run `sudo apt install libwebkit2gtk-4.1-0 libappindicator3-1 librsvg2-2`.
- **Need help?** Open an issue at [github.com/nickksoares/louvorja-multiplataform/issues](https://github.com/nickksoares/louvorja-multiplataform/issues).

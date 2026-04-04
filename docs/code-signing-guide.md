# Code Signing Guide

This guide is for maintainers and IT administrators who want to eliminate OS security warnings when users install LouvorJA.

## Why sign your builds?

Without code signing, users see security warnings:
- **Windows:** SmartScreen "Windows protected your PC" dialog
- **macOS:** Gatekeeper "unidentified developer" block

Signing builds trust with the operating system so these warnings disappear.

---

## macOS Signing

### 1. Enroll in Apple Developer Program

- Go to [developer.apple.com](https://developer.apple.com) and enroll ($99/year).
- You need an Apple ID associated with your organization.

### 2. Create a signing certificate

- Open **Xcode** → Preferences → Accounts → Manage Certificates
- Create a **"Developer ID Application"** certificate
- Export as `.p12` file with a password

### 3. Configure CI secrets

Base64-encode your certificate and add these GitHub Secrets:

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE` | Base64 of `.p12` file: `base64 -i certificate.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting `.p12` |
| `APPLE_SIGNING_IDENTITY` | Certificate name (e.g., `Developer ID Application: Your Org (TEAMID)`) |

### 4. Enable notarization (recommended)

Notarization lets macOS verify your app online, removing all warnings.

- Go to [App Store Connect](https://appstoreconnect.apple.com) → Users and Access → Keys
- Create an **App Store Connect API Key** with Developer role
- Download the `.p8` key file

Add these secrets:

| Secret | Value |
|--------|-------|
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect |
| `APPLE_API_KEY` | Key ID from App Store Connect |
| `APPLE_API_KEY_PATH` | Content of the `.p8` file |

### 5. Verify

After a signed build:
```bash
codesign -v --deep /Applications/LouvorJA.app
# Should output: valid on disk
```

---

## Windows Signing

### Option A: OV Certificate ($100-200/year)

- Purchase from DigiCert, Sectigo, or GlobalSign
- Builds SmartScreen reputation over time (warnings gradually disappear after many installs)
- Best for: getting started, budget-conscious

### Option B: EV Certificate ($300-400/year)

- Requires hardware token (USB key)
- **Immediate** SmartScreen bypass — no reputation building needed
- Best for: production deployments, large churches

### Configure CI secrets

| Secret | Value |
|--------|-------|
| `WINDOWS_CERTIFICATE` | Base64 of `.pfx` file |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for `.pfx` file |

### Verify

After a signed build:
```powershell
signtool verify /pa LouvorJA_0.1.0_x64-setup.exe
# Should output: Successfully verified
```

---

## Testing without code signing

For development and testing, code signing is optional. Users will see security warnings but can still install the app by following the steps in the [installation guides](installation/).

---

## Cost summary

| Platform | Type | Annual Cost | SmartScreen/Gatekeeper |
|----------|------|-------------|------------------------|
| macOS | Developer ID | $99/year | Immediate bypass with notarization |
| Windows | OV Certificate | $100-200/year | Gradual reputation building |
| Windows | EV Certificate | $300-400/year | Immediate bypass |
| Linux | N/A | Free | No signing required |

---
feature: installers-pipeline
gate: 8
phase: C+D - Guides & Polish
date: 2026-02-18
status: complete
---

# Phase C+D Subtasks: User Guides & Polish

## TASK-011: Windows Installation Guide

### ST-011-1: Write English Windows guide (5 min)
**File:** `docs/installation/windows.md` (new)
**Action:** Write step-by-step guide:
1. Go to releases page, download LouvorJA-setup.exe
2. Double-click the installer
3. If SmartScreen warning: "Windows protected your PC" → Click "More info" → "Run anyway" (explain this is normal for new software)
4. Choose install mode: "Install for me only" (recommended, no admin) or "Install for all users"
5. Follow installer wizard
6. Launch LouvorJA from Start menu or desktop shortcut
7. Select your language
8. Verify: Help → About → confirm version number
**Tone:** Friendly, reassuring. Written for Dona Maria.

### ST-011-2: Translate to Portuguese (3 min)
**File:** `docs/installation/windows-pt.md` (new)

### ST-011-3: Translate to Spanish (3 min)
**File:** `docs/installation/windows-es.md` (new)

---

## TASK-012: macOS Installation Guide

### ST-012-1: Write English macOS guide (5 min)
**File:** `docs/installation/macos.md` (new)
**Action:** Write step-by-step guide:
1. Go to releases page, download LouvorJA.dmg
2. Open the .dmg file
3. Drag LouvorJA to Applications folder
4. Open LouvorJA from Applications
5. If Gatekeeper warning: "LouvorJA cannot be opened because it is from an unidentified developer" → Go to System Settings → Privacy & Security → Click "Open Anyway" (explain this is normal until code signing is set up)
6. Select your language
7. Verify: LouvorJA menu → About → confirm version number
**Note:** Address both ARM (Apple Silicon) and Intel Macs — same installer, no user action needed.

### ST-012-2: Translate to Portuguese (3 min)
**File:** `docs/installation/macos-pt.md` (new)

### ST-012-3: Translate to Spanish (3 min)
**File:** `docs/installation/macos-es.md` (new)

---

## TASK-013: Linux Installation Guide

### ST-013-1: Write English Linux guide (5 min)
**File:** `docs/installation/linux.md` (new)
**Action:** Write step-by-step guide with two paths:

**AppImage (recommended — works everywhere):**
1. Download LouvorJA.AppImage
2. Make executable: right-click → Properties → Permissions → "Allow executing" (or `chmod +x`)
3. Double-click to run
4. If nothing happens: install `libwebkit2gtk-4.1` and `libappindicator3-1` via your package manager
5. Select your language
6. Verify version

**Debian/Ubuntu (.deb):**
1. Download LouvorJA.deb
2. Double-click to open with Software Center, or: `sudo dpkg -i LouvorJA.deb`
3. If dependency errors: `sudo apt-get install -f`
4. Launch from application menu

### ST-013-2: Translate to Portuguese (3 min)
**File:** `docs/installation/linux-pt.md` (new)

### ST-013-3: Translate to Spanish (3 min)
**File:** `docs/installation/linux-es.md` (new)

---

## TASK-014: Code Signing Setup Guide

### ST-014-1: Write code signing guide (5 min)
**File:** `docs/code-signing-guide.md` (new)
**Audience:** Maintainers/IT admins (Ricardo persona)
**Sections:**
1. **Why Sign?** — Eliminates OS security warnings, builds user trust
2. **macOS Signing:**
   - Enroll in Apple Developer Program ($99/year)
   - Create "Developer ID Application" certificate in Xcode
   - Export as .p12, base64-encode for CI secret
   - Required secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`
   - Notarization: Create App Store Connect API key, set `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH`
3. **Windows Signing:**
   - OV certificate ($100-200/year): Still shows SmartScreen initially, builds reputation over time
   - EV certificate ($300-400/year): Immediate SmartScreen bypass
   - Set `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` in GitHub Secrets
4. **Verification:** How to confirm signed builds (codesign -v on macOS, signtool on Windows)

---

## TASK-015: Verify onboarding works offline

### ST-015-1: Audit onboarding for network calls (3 min)
**Files:** `src/lib/onboarding.ts`, `src/stores/onboarding-store.ts`
**Action:** Read both files and search for any `fetch`, `invoke`, `useQuery`, or network-dependent calls. Document findings.

### ST-015-2: Verify locale completeness (3 min)
**Files:** `src/locales/en.json`, `pt.json`, `es.json`
**Action:** Search for all `onboarding.*` keys and confirm parity across all 3 files.

### ST-015-3: Test offline first launch (3 min)
**Action:** Disable network, launch app fresh (clear local storage), verify onboarding completes without errors.

---

## TASK-016: Add version display

### ST-016-1: Add version to status bar or settings (5 min)
**File:** `src/components/layout/status-bar.tsx` (preferred) or settings page
**Action:** Use Tauri's `getVersion()` from `@tauri-apps/api/app` to read version, display as small text in the status bar right side:
```typescript
import { getVersion } from "@tauri-apps/api/app";
// In component:
const [version, setVersion] = useState("");
useEffect(() => { getVersion().then(setVersion); }, []);
// In render:
<span className="text-xs text-muted-foreground">v{version}</span>
```
**Verify:** Status bar shows "v0.1.0" at bottom right.

---

## Phase C+D Verification Checklist

After all Phase C+D subtasks:
- [ ] `docs/installation/` has 9 files (3 platforms × 3 languages)
- [ ] `docs/code-signing-guide.md` exists with macOS + Windows sections
- [ ] Each guide has ≤10 steps
- [ ] Each guide addresses security warnings
- [ ] Each guide has "Verify your installation" section
- [ ] Onboarding works offline (no network errors)
- [ ] All onboarding keys in all 3 locales
- [ ] Version visible in status bar
- [ ] Run `pnpm vite build && npx tsc --noEmit` — passes

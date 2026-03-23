# Pack Sync — Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix hidden-file contamination and canonical path format in the admin panel pack builder, and add a required language field to every pack publish.

**Architecture:** All changes are in `admin-panel/` (Next.js). `page.tsx` handles the file processing UI and path transformation. `manifest.ts` owns the shared manifest type. The publish API route (`/api/packs/publish/route.ts`) builds the final manifest. This plan is fully independent of the Rust backend plan.

**Tech Stack:** TypeScript, Next.js 14 App Router. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-22-pack-sync-cdn-fixes-design.md`

---

## File Map

| File | Change |
|---|---|
| `admin-panel/src/app/packs/new/page.tsx` | Add `isSystemFile()`, add `language` select field, rewrite `canonicalPackPath()` |
| `admin-panel/src/lib/manifest.ts` | Add `language` to `ManifestPack`; replace `dbUrl`/`dbVersion` with `databases` |
| `admin-panel/src/app/api/packs/publish/route.ts` | Propagate `language` from request body into manifest packs; use `databases` field |

---

### Task 1: Add `isSystemFile()` filter

**Files:**
- Modify: `admin-panel/src/app/packs/new/page.tsx` (after line 92, before `extractAlbumName`)

The `isSystemFile` function must be added and applied in two places: (1) when the file list is built from the input, and (2) as a guard in `groupFiles()`.

- [ ] **Step 1: Add the filter function**

Open `admin-panel/src/app/packs/new/page.tsx`. After the closing `}` of `detectFileType` (around line 92), add:

```typescript
/**
 * Returns true for macOS metadata files (.DS_Store), __MACOSX folders,
 * and any other hidden/system path segments.
 */
function isSystemFile(relativePath: string): boolean {
  return relativePath.split("/").some(
    (seg) => seg.startsWith(".") || seg === "__MACOSX"
  );
}
```

- [ ] **Step 2: Apply filter when building the file list**

In `handleFilesSelected` (around line 271), find the `for` loop that builds `localFiles`. Add the `isSystemFile` guard right after the `relativePath` is derived and before pushing to `localFiles`:

```typescript
// BEFORE (actual code pattern around line 271-284):
for (let i = 0; i < selected.length; i++) {
  const file = selected[i];
  const relativePath =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name;
  // ... db file check ...
  const detectedType = detectFileType(relativePath);
  localFiles.push({ file, relativePath, size: file.size, detectedType });
}

// AFTER — add isSystemFile guard before the detectFileType call:
for (let i = 0; i < selected.length; i++) {
  const file = selected[i];
  const relativePath =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name;
  if (isSystemFile(relativePath)) continue;  // ADD THIS LINE
  // ... db file check ...
  const detectedType = detectFileType(relativePath);
  localFiles.push({ file, relativePath, size: file.size, detectedType });
}
```

- [ ] **Step 3: Add defensive guard in `groupFiles()`**

Inside `groupFiles()` (around line 196), after the `if (file.detectedType === "unknown") continue;` line, add:

```typescript
if (file.relativePath.split("/").some((s) => s.startsWith(".") || s === "__MACOSX")) continue;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd admin-panel && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add admin-panel/src/app/packs/new/page.tsx
git commit -m "fix(admin): filter .DS_Store and __MACOSX files from pack upload"
```

---

### Task 2: Add required `language` field to the publish UI

**Files:**
- Modify: `admin-panel/src/app/packs/new/page.tsx`

The `language` field must be added to component state and rendered as a `<select>` in the "setup" step. Publishing must be blocked if no language is selected.

- [ ] **Step 1: Add language to state**

Find the `useState` declarations at the top of the `NewPackPage` component (around line 248). Add:

```typescript
const [language, setLanguage] = useState<"pt-BR" | "es" | "en-US" | "">("");
```

- [ ] **Step 2: Add the language select to the form**

In the "setup" step JSX, after the `packPrefix` input field, add:

```tsx
<div className="space-y-2">
  <Label htmlFor="language">
    Language <span className="text-destructive">*</span>
  </Label>
  <select
    id="language"
    value={language}
    onChange={(e) => setLanguage(e.target.value as typeof language)}
    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    required
  >
    <option value="" disabled>Select a language…</option>
    <option value="pt-BR">Português (Brasil)</option>
    <option value="es">Español</option>
    <option value="en-US">English (US)</option>
  </select>
</div>
```

- [ ] **Step 3: Block publish if no language selected**

The setup step has no "Next" button — file selection automatically advances to "configure". Guard publish at two locations:

**3a.** Add a guard at the top of `handlePublish` (around line 305), right after `setStep("publish")`:

```typescript
const handlePublish = async () => {
  if (!language) {
    setPublishState({ status: "error", progress: 0, message: "Failed", error: "Please select a language before publishing." });
    return;
  }
  setStep("publish");
  // ... rest of function
```

**3b.** Find the Publish button in the "configure" step (search for `onClick={() => void handlePublish()}`). Add a disabled condition:

```tsx
disabled={!language}
```

- [ ] **Step 4: Pass language to publish calls**

Search for calls to the publish API (`/api/packs/publish`) in the component. Add `language` to the request body:

```typescript
// In the fetch body for /api/packs/publish:
body: JSON.stringify({
  // ...existing fields...
  language,   // ADD THIS
}),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd admin-panel && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add admin-panel/src/app/packs/new/page.tsx
git commit -m "feat(admin): add required language field to pack publish UI"
```

---

### Task 3: Rewrite `canonicalPackPath()` with DB-aligned paths

**Files:**
- Modify: `admin-panel/src/app/packs/new/page.tsx`

The new canonical path format must match what the legacy DB uses:
- `config/musicas/{album}/{id}/{file}` → `musics/{lang-short}/{album}/{file}`
- `config/capas/{id}/{file}` → `covers/{file}`
- `config/imagens/{id}/{file}` → `images/{file}`

Where `lang-short` is: `pt-BR→pt`, `en-US→en`, `es→es`.

- [ ] **Step 1: Add `bcp47ToLangShort()` helper**

After `isSystemFile`, add:

```typescript
function bcp47ToLangShort(tag: string): string {
  const map: Record<string, string> = { "pt-BR": "pt", "en-US": "en", es: "es" };
  return map[tag] ?? tag;
}
```

- [ ] **Step 2: Replace `canonicalPackPath()` entirely**

Delete the current implementation (lines 140–167) and replace with:

```typescript
/**
 * Transform an FTP-structured path to the canonical DB-aligned path.
 * Paths must match what the legacy DB files table stores so extracted
 * files can be resolved with a simple app_data_dir.join(path).
 *
 *   config/musicas/{album}/{id}/{file}  → musics/{lang}/{album}/{file}
 *   config/capas/{id}/{file}            → covers/{file}
 *   config/imagens/{id}/{file}          → images/{file}
 *   Unrecognised paths                  → null (caller skips these)
 */
function canonicalPackPath(
  relativePath: string,
  _fileType: FileType,
  lang: string,         // BCP 47 tag, e.g. "pt-BR"
): string | null {
  const lower = relativePath.toLowerCase();
  const stripped = lower.replace(/^(en|es|pt)\//, "");
  const parts = relativePath.replace(/^(en|es|pt)\//i, "").split("/");
  const filename = parts[parts.length - 1];
  if (!filename) return null;

  const langShort = bcp47ToLangShort(lang);

  // Album covers: config/capas/{id}/{file} → covers/{file}
  if (stripped.startsWith("config/capas/")) {
    return `covers/${filename}`;
  }

  // Song covers/images: config/imagens/{id}/{file} → images/{file}
  if (stripped.startsWith("config/imagens/") || stripped.startsWith("config/images/")) {
    return `images/${filename}`;
  }

  // Audio/playback: config/musicas/{album}/{id}/{file} → musics/{lang}/{album}/{file}
  if (stripped.startsWith("config/musicas/") || stripped.startsWith("config/musics/")) {
    const albumName = parts[2]; // e.g. "Cânticos de Esperança"
    if (!albumName) return null;
    return `musics/${langShort}/${albumName}/${filename}`;
  }

  // Unrecognised — skip
  return null;
}
```

- [ ] **Step 3: Update all callers of `canonicalPackPath`**

Search the file for every call to `canonicalPackPath`. Each call must now pass `language` as the third argument and handle `null` return (skip the file):

```typescript
// BEFORE:
const packPath = canonicalPackPath(relativePath, fileType);

// AFTER:
const packPath = canonicalPackPath(relativePath, fileType, language);
if (!packPath) continue; // or filter out the file
```

Also update `groupFiles()` to add the second guard: skip files whose `relativePath` (now the canonical path) would return `null` from `canonicalPackPath`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd admin-panel && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add admin-panel/src/app/packs/new/page.tsx
git commit -m "fix(admin): rewrite canonicalPackPath to use DB-aligned paths (musics/covers/images)"
```

---

### Task 4: Update `manifest.ts` types

**Files:**
- Modify: `admin-panel/src/lib/manifest.ts`

`ManifestPack` gains `language: string`. `ContentManifest` replaces `dbUrl`/`dbVersion` with `databases`.

- [ ] **Step 1: Update the TypeScript interfaces**

Open `admin-panel/src/lib/manifest.ts`. Replace the entire file content with:

```typescript
export interface ManifestFile {
  path: string;
  type: "audio" | "playback" | "cover" | "album_cover";
  size: number;
  albumName?: string;
}

export interface ManifestPack {
  id: string;
  url: string;
  version: number;
  size: number;
  sha256: string;
  files: ManifestFile[];
  language: string;   // BCP 47 tag, e.g. "pt-BR"
}

export interface DbEntry {
  url: string;
  version: number;
}

export interface ContentManifest {
  manifestVersion: number;
  generatedAt: string;
  packs: ManifestPack[];
  // dbUrl and dbVersion are REMOVED — replaced by databases
  databases: Record<string, DbEntry>;  // keyed by BCP 47 tag
}

const MANIFEST_KEY = "manifest.json";

export async function fetchManifest(): Promise<ContentManifest | null> {
  const { downloadFromR2, existsOnR2 } = await import("./r2");
  if (!(await existsOnR2(MANIFEST_KEY))) return null;
  const buf = await downloadFromR2(MANIFEST_KEY);
  const raw = JSON.parse(buf.toString("utf-8")) as ContentManifest;
  // Back-compat: if old manifest has no databases field, default to empty
  return { databases: {}, ...raw };
}

export async function uploadManifest(manifest: ContentManifest): Promise<void> {
  const { uploadToR2 } = await import("./r2");
  const json = JSON.stringify(manifest, null, 2);
  await uploadToR2(MANIFEST_KEY, Buffer.from(json), "application/json");
}

export function incrementManifestVersion(
  manifest: ContentManifest | null,
): ContentManifest {
  return {
    manifestVersion: (manifest?.manifestVersion ?? 0) + 1,
    generatedAt: new Date().toISOString(),
    packs: manifest?.packs ?? [],
    databases: manifest?.databases ?? {},
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd admin-panel && npx tsc --noEmit
```
Expected: type errors will appear in the publish route (Task 5 fixes those).

- [ ] **Step 3: Commit**

```bash
git add admin-panel/src/lib/manifest.ts
git commit -m "feat(admin): update ContentManifest — add ManifestPack.language, replace dbUrl with databases"
```

---

### Task 5: Update publish API route to propagate `language` and `databases`

**Files:**
- Modify: `admin-panel/src/app/api/packs/publish/route.ts`

The route body must accept `language` and include it on every pack entry. It must accept and write `databases` instead of `dbUrl`/`dbVersion`.

- [ ] **Step 1: Read the current publish route**

Open `admin-panel/src/app/api/packs/publish/route.ts` and read it fully.

- [ ] **Step 2: Add `language` to the request body type**

Find the `Body` / `RequestBody` interface (or inline type). Add:
```typescript
language: string;          // BCP 47 tag — required
```

- [ ] **Step 3: Propagate `language` when building/updating the pack entry**

Find where a `ManifestPack` object is constructed. Add the `language` field:
```typescript
const pack: ManifestPack = {
  id: packId,
  url: packUrl,
  version: nextVersion,
  size: totalSize,
  sha256: sha256hex,
  files: manifestFiles,
  language: body.language,   // ADD THIS
};
```

- [ ] **Step 4: Replace `dbUrl`/`dbVersion` handling with `databases`**

Find any code that reads `body.dbUrl` / `body.dbVersion` and sets them on the manifest. Replace with:

```typescript
// BEFORE (example):
if (body.dbUrl && body.dbVersion != null) {
  manifest.dbUrl = body.dbUrl;
  manifest.dbVersion = body.dbVersion;
}

// AFTER:
if (body.dbUrl && body.dbVersion != null) {
  manifest.databases ??= {};
  manifest.databases[body.language] = {
    url: body.dbUrl,
    version: body.dbVersion,
  };
}
```

Also ensure any code that reads `manifest.dbUrl` / `manifest.dbVersion` is updated to use `manifest.databases`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd admin-panel && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add admin-panel/src/app/api/packs/publish/route.ts
git commit -m "feat(admin): propagate language into ManifestPack; use databases instead of dbUrl/dbVersion"
```

---

### Task 6: Final admin panel integration check

- [ ] **Step 1: Run the full admin panel build**

```bash
cd admin-panel && pnpm build
```
Expected: build completes with no TypeScript or lint errors.

- [ ] **Step 2: Verify no `dbUrl` / `dbVersion` references remain**

```bash
grep -r "dbUrl\|dbVersion" admin-panel/src --include="*.ts" --include="*.tsx"
```
Expected: zero matches (only `databases` should remain).

- [ ] **Step 3: Verify no untransformed `config/` paths in canonical output**

```bash
grep -r "\"config/" admin-panel/src --include="*.ts" --include="*.tsx"
```
Expected: zero matches in non-comment code.

- [ ] **Step 4: Final commit**

```bash
git add -p   # review staged changes
git commit -m "chore(admin): admin panel pack sync CDN fixes complete"
```

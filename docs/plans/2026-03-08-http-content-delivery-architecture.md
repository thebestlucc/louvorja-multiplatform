# HTTP content delivery architecture for updates

This document explains a low-cost, long-term architecture for replacing the legacy FTP-based content delivery flow with HTTP/CDN delivery. It is written for the LouvorJA desktop migration, where app-binary updates and content updates should remain separate concerns.

## What you should build

Use **Cloudflare R2 Standard** as the origin, expose it through a **custom domain on Cloudflare CDN**, and publish content as **immutable pack files plus a tiny manifest layer**.

The core idea is simple:

- FTP used to answer "what file is missing?"
- The HTTP/CDN version should answer "what files and packs should exist for content version N?"
- The answer should come from a **signed manifest**, not from listing remote directories.

This aligns with the repo's current direction:

- app-binary updates remain under the Tauri updater
- content updates move through `content_sync`
- the existing legacy full fetch remains as degraded fallback when manifest delivery is unavailable

See the related internal references:

- `docs/plans/2026-03-08-legacy-style-smart-content-sync.md`
- `src/types/content-sync.ts`
- `src-tauri/src/content_sync/mod.rs`
- `src/components/migration/legacy-fetch-wizard.tsx`

---

## Recommended architecture

### 1. Keep app updates and content updates separate

Do not mix Tauri app releases with hymn/media/content delivery.

- **App updater**: install new desktop binaries.
- **Content sync**: install new hymns, media, images, metadata, and repairs for missing files.

That separation already exists conceptually in the current repo and should remain.

### 2. Publish three kinds of artifacts

#### Bootstrap file

A tiny file such as `latest.json` should be the only thing the app checks on startup.

Example responsibilities:

- current `content_version`
- `manifest_url`
- `min_app_version`
- generation timestamp
- optional signature

This file can be uncached or short-TTL. It is tiny, so it does not materially affect cost.

#### Manifest files

Manifest files describe what changed and where each asset lives.

Recommended shape:

- `summary.json` or `latest.json` for quick checks
- paged manifest files for hymns, albums, media, and deletions
- each record includes:
  - logical file path or entity id
  - content hash
  - file size
  - pack id
  - deleted flag
  - updated timestamp

These files replace the old FTP directory-awareness model.

#### Immutable pack files

Store actual payloads as immutable ZIP packs:

- `packs/audio/<hash>.zip`
- `packs/images/<hash>.zip`
- `packs/metadata/<hash>.zip` or `.json.zst`

Recommended pack target size:

- **64 MB to 256 MB** preferred
- **under 512 MB** hard limit if you want default Cloudflare caching on Free, Pro, or Business plans

---

## Why packs are better than a file-per-object model

You were already thinking about grouping files into ZIPs. That instinct is correct, but the grouping strategy matters.

### Good pack strategy

Group by:

- asset type
- update frequency
- logical locality

Examples:

- audio packs separate from images
- hot content in smaller packs
- very stable content in larger packs

### Bad pack strategy

Avoid version-wide archives such as:

- `release-127.zip`
- `release-128.zip`

That approach is simple, but it forces users to redownload too much and duplicates storage across releases.

### Better rule

Name packs by **content hash**, not by release number.

Examples:

- `audio-8f3c1d....zip`
- `images-29b7aa....zip`

Then each content manifest references the pack ids it needs. If a pack does not change between versions, you reuse it without re-uploading it or re-downloading it.

---

## Storage and delivery layout

Suggested layout:

```text
/channels/stable/latest.json
/manifests/content-v128/summary.json
/manifests/content-v128/hymns-1.json.zst
/manifests/content-v128/albums-1.json.zst
/manifests/content-v128/deletions.json.zst
/packs/audio/audio-8f3c1d.zip
/packs/images/images-29b7aa.zip
/packs/metadata/meta-a18d1b.json.zst
```

### Delivery rules

- Use a custom domain such as `cdn.louvorja.com.br`.
- Do not rely on `r2.dev` for production traffic.
- Set immutable cache headers on packs:
  - `Cache-Control: public, max-age=31536000, immutable`
- Keep `latest.json` short-lived or ETag-based.
- Use explicit cache rules for manifest files if you keep them as `.json`.
- If you publish manifest pages as `.zst`, they are much easier to cache efficiently.

---

## Client sync flow

The client flow should be:

1. Read local `content_version` and local manifest state.
2. Fetch `latest.json`.
3. If version is unchanged, stop.
4. If version changed, fetch the new manifest pages.
5. Compute a sync plan:
   - new files
   - updated files
   - deleted remote-managed files
   - missing local assets that need repair
6. Download only the missing packs.
7. Verify pack hash before extraction.
8. Extract into a temp directory.
9. Atomically move files into the local content store.
10. Persist the new `content_version` and sync metadata.

This fits naturally with the existing `smart` versus `degraded` `content_sync` model in the current codebase.

---

## Cost model

Pricing snapshot verified on **2026-03-08** against the official Cloudflare docs.

### Why R2 Standard is the right class

R2 Standard is the correct choice for publicly downloaded updater content because:

- storage is cheap
- egress is free
- retrieval is free

R2 Infrequent Access looks attractive for "rarely changing" files, but that is the wrong optimization here. Your content may change infrequently, but when it is downloaded it can be downloaded **a lot**.

### Example numbers

Assumptions:

- total content stored: `20 GB`
- simultaneous worst-case download event: `11,000 users`
- total full-refresh traffic: `20 GB x 11,000 = 220,000 GB`

With R2 Standard:

- storage: about **$0.15/month** after the `10 GB` free tier
- egress: **$0**
- retrieval: **$0**

With R2 Infrequent Access:

- retrieval is billed at **$0.01/GB**
- worst-case full refresh would cost about **$2,200** in retrieval alone

### Request-cost intuition

If you split `20 GB` into `100` packs of `200 MB`:

- `11,000 users x 100 pack requests = 1.1 million GETs`

That is still inside the current monthly free Class B allowance before accounting for CDN cache hits.

### What really controls cost

The cost levers are:

- number of unique pack versions you retain
- whether downloads hit CDN cache or bypass it
- whether you accidentally choose Infrequent Access
- whether you force users to redownload unchanged data

At your scale, storage cost is small. Bad packaging and bad cacheability are the real risks.

---

## Operational notes

### Public bucket listing is not your index

The bucket is storage, not the source of truth.

- The app should never try to discover files by browsing the bucket.
- The app should trust only the signed manifest.

### Workers are optional, not the data plane

Use a Worker only if you need:

- pretty URLs
- auth gates
- manifest signing or redirection

Do **not** proxy all large ZIP downloads through a Worker. Let the CDN serve the files directly from the custom domain.

### Compression expectations

ZIP helps here mainly by reducing request counts and improving cache behavior.

For already compressed assets such as:

- MP3
- JPG
- PNG

do not expect large size reduction from ZIP itself.

### Integrity and safety

You should add:

- manifest signature verification
- per-pack hash verification
- temp-directory extraction
- atomic rename/move on completion
- resume support for interrupted downloads

---

## Rollout plan

### Phase 1

Keep the current legacy full-fetch path and add a static HTTP bootstrap + manifest service.

Deliver:

- `latest.json`
- paged manifests
- pack downloader
- local verification
- degraded fallback to legacy fetch

### Phase 2

Switch the normal path to smart sync by manifest.

Deliver:

- selective pack download
- repair of missing local assets
- remote-managed deletions
- better sync reporting in the UI

### Phase 3

Optimize publishing and retention.

Deliver:

- automatic pack reuse across releases
- garbage collection of orphaned packs after a retention window
- optional secondary mirror for backup, not for primary traffic

---

## Recommended decisions

Use these decisions unless a later constraint forces a change:

- **Origin**: Cloudflare R2 Standard
- **Transport**: HTTPS over Cloudflare custom domain
- **Artifact strategy**: immutable hash-named ZIP packs + manifest files
- **Bootstrap check**: tiny `latest.json`
- **Integrity**: signed manifest + pack hashes
- **Fallback**: keep legacy full fetch
- **Cache strategy**: immutable packs, short-lived bootstrap
- **Pack size**: target 64-256 MB, stay under 512 MB

---

## What to avoid

- one giant ZIP for the whole release
- a raw file-per-object strategy for thousands of tiny files
- using `r2.dev` as the production delivery URL
- choosing R2 Infrequent Access for updater traffic
- relying on bucket listing instead of explicit manifests
- pushing all file delivery through Workers

---

## Sources

Checked on 2026-03-08:

- Cloudflare R2 pricing: <https://developers.cloudflare.com/r2/pricing/>
- Cloudflare R2 public buckets and custom domains: <https://developers.cloudflare.com/r2/buckets/public-buckets/>
- Cloudflare default cache behavior and cacheable size limits: <https://developers.cloudflare.com/cache/concepts/default-cache-behavior/>
- Cloudflare R2 storage classes: <https://developers.cloudflare.com/r2/buckets/storage-classes/>


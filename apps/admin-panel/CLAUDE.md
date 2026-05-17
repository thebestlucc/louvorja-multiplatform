# CLAUDE.md — apps/admin-panel

Next.js 14 App Router CDN pack publishing tool. Not in pnpm workspace — run commands from inside this directory.

## Commands

```bash
# Run from apps/admin-panel/
pnpm dev        # dev server (localhost:3000)
pnpm build
pnpm lint
```

## Structure

```
src/
├── app/
│   ├── page.tsx        # Main upload UI (pack builder + manifest publisher)
│   └── db/page.tsx     # Database management
├── components/ui/      # button, card, dialog, input, label, progress, table (shadcn-style)
└── lib/
    ├── manifest.ts     # ContentManifest, ManifestPack, DbEntry types + fetch/upload/increment helpers
    ├── r2.ts           # R2 (S3-compatible) upload/download via @aws-sdk/client-s3
    ├── pack-builder.ts # canonicalPackPath() + ZIP pack construction
    ├── catcher.ts      # Error wrapper
    └── utils.ts        # cn()
```

## Key Patterns

- **Manifest types:** `ContentManifest { manifestVersion, generatedAt, packs, databases }`. `databases` keyed by BCP 47 (e.g. `"pt-BR"` → `DbEntry { url, version }`). `ManifestPack { id, url, version, size, sha256, files, language }`.
- **canonicalPackPath():** Normalizes pack file paths before R2 upload — must be consistent with what desktop `pack_sync` expects.
- **R2 client:** `@aws-sdk/client-s3` with S3-compatible endpoint. Env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`. See `.env.example`.
- **Back-compat:** `fetchManifest()` defaults `databases` to `{}` if absent (old manifests predate per-language DB entries).
- **Tailwind:** v4 (`@tailwindcss/postcss`). `tailwind.config.ts` exists (unlike desktop which is CSS-first). UI components follow shadcn conventions.

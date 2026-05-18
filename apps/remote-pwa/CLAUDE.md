# CLAUDE.md — apps/remote-pwa

Companion PWA for controlling LouvorJA from phone/tablet. React 19 + TanStack Router + Zustand + Tailwind v4 + Vitest.
Served by Tauri backend's built-in HTTP+WS server. Routes: `pair → search → queue → live → service → settings`.

## Commands

```bash
pnpm --filter remote-pwa dev|build|test
```

CI: `.github/workflows/remote-perf.yml` runs Lighthouse perf audit (`lighthouserc.json`).

---

## Architecture Patterns

- **Pairing flow:** HTTP POST `/pair` (with PIN) → device token (base64url) → WebSocket upgrade using `["bearer", token]` subprotocol (browsers block custom headers on WS upgrade).
- **HMAC auth:** Outbound envelopes signed with HMAC-SHA256. Token decoded from base64url to raw bytes — Rust backend uses raw bytes. Mismatch = all commands rejected. See `lib/crypto.ts` + `lib/ws-client.ts`.
- **Crypto fallback:** `lib/crypto.ts` pure-JS SHA-256/HMAC for non-secure (HTTP) contexts where `crypto.subtle` is undefined.
- **Reconnect:** Exponential backoff 1/2/4/8s (capped) in `ws-client.ts`.
- **Wake lock:** `hooks/use-wake-lock.ts` prevents screen sleep during active session.
- **Storage:** `lib/storage.ts` persists pairing credentials (device token, host URL) to localStorage.

---

## Common Errors to Avoid

1. **HMAC requires `serde_json preserve_order`** in `src-tauri/Cargo.toml`: `serde_json = { features = ["preserve_order"] }`. Without it, `serde_json::Value` uses BTreeMap (alphabetical keys) — re-serialization breaks HMAC byte-match with `JSON.stringify`. Single-key payloads work by accident; **2+ key payloads fail silently**.

2. **WS error envelope:** Server sends `{ type: "error", op: <reqOp>, payload: { error: "..." } }`. Client MUST early-return on `type === "error"` before dispatching to op handlers — otherwise payload-shape guards fail silently.

3. **Stale-state trap in browse UIs:** `useEffect` with deps `[tab, ws, wsState]` resets state on ANY ws reconnect mid-flow. Split into (1) tab-only reset, (2) `[tab, ws, wsState]` fetch with guard on existing state. See `routes/search.tsx` bible browse.

4. **HighlightedSnippet:** FTS `snippet()` returns `<mark>...</mark>`. Rendering `{text}` in React escapes tags to literals. Use `HighlightedSnippet` component — splits on `/(<mark>.*?<\/mark>)/g`. Identical component exists in `apps/desktop/src/components/ui/`.

5. **Version-scoped bible search:** `bible.search` WS op accepts optional `versionId`. Pass `selectedVersion.id` when user picked a version; else omit for all-versions search.

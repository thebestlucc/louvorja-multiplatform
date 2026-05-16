// HMR cleanup for video-player-store.
//
// Why this file exists:
// `video-player-store.ts` is compiled under `tsconfig.unit-tests.json`
// (module: CommonJS) for `pnpm test:unit`. A top-level `import.meta.hot`
// in the store breaks that compile (TS1343/TS2339). Vite handles
// `import.meta.hot` natively in ESM modules — so the HMR-only side effect
// is moved here. This file is loaded as a side-effect import from
// `src/main.tsx` and is NOT in the unit-tests tsconfig include list.
//
// Tradeoff: HMR cleanup runs when THIS module is replaced. If the main
// store module changes (and this module does not), the OLD store's
// streaming subscription and pending throttle timer leak until a full
// reload. This is dev-only and harmless beyond extra IPC calls — the
// streaming forwarder swallows errors via `invoke().catch(() => {})`.

import { __unsubStreaming, __clearStreamingThrottle } from "./video-player-store";

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    __unsubStreaming();
    __clearStreamingThrottle();
  });
}

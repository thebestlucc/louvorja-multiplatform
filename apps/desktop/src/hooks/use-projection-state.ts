import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ProjectionDelta, ProjectionSnapshot } from "../lib/bindings";
import { getProjectionSnapshot } from "../lib/tauri/display";
import { applyDelta } from "../lib/projection/apply-delta";

/**
 * Canonical Projection State subscriber for projector + return webviews.
 *
 * - On mount: subscribes FIRST to the `projection-delta` event, then fetches
 *   the initial snapshot. Subscribing first means a Delta that lands between
 *   the listen() call and the fetch is held in Tauri's listener queue; once
 *   the snapshot resolves, the queued delta either applies cleanly (versions
 *   line up) or triggers the universal recovery rule.
 * - On every delta: applies the universal recovery rule (ADR-0003).
 *   `delta.fromVersion !== local.version → re-fetch snapshot`.
 *
 * Returns `null` until the initial snapshot resolves. Consumers should render
 * a default/empty state while waiting.
 */
export function useProjectionState(): ProjectionSnapshot | null {
  const [snapshot, setSnapshot] = useState<ProjectionSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    let current: ProjectionSnapshot | null = null;

    const setLocal = (next: ProjectionSnapshot) => {
      current = next;
      setSnapshot(next);
    };

    const rehydrate = async () => {
      const fresh = await getProjectionSnapshot();
      if (cancelled) return;
      setLocal(fresh);
    };

    const unlistenP = listen<ProjectionDelta>("projection-delta", (event) => {
      if (cancelled) return;
      if (!current) {
        // Snapshot fetch hasn't resolved yet. Drop this delta and rely on the
        // resolved snapshot (or the next delta) to bring local state in sync.
        // The fetched snapshot is taken under the Hub's state lock so it's
        // already-or-ahead-of any in-flight delta.
        return;
      }
      const delta = event.payload;
      if (delta.fromVersion !== current.version) {
        // Gap detected — universal recovery rule. Fire-and-forget; the next
        // tick will set snapshot from the fresh fetch.
        rehydrate().catch(() => {});
        return;
      }
      setLocal(applyDelta(current, delta));
    });

    rehydrate().catch(() => {});

    return () => {
      cancelled = true;
      unlistenP.then((fn) => fn()).catch(() => {});
    };
  }, []);

  return snapshot;
}

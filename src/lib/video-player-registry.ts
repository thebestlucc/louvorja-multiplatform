// Module-level singleton — safe to share across React renders.
let hiddenHost: HTMLElement | null = null;
let playerNode: HTMLElement | null = null;
let attached = false;

/** Called once by PersistentVideoPlayer on mount to register the hidden host div. */
export function registerHiddenHost(el: HTMLElement): void {
  hiddenHost = el;
}

/**
 * Called when a new player element (YT iframe or <video>) is ready.
 * Resets `attached` so VideoPreviewSlot can attach on the next call.
 */
export function registerPlayerNode(el: HTMLElement): void {
  playerNode = el;
  attached = false;
}

/** Returns the current player node, or null if none is registered. */
export function getPlayerNode(): HTMLElement | null {
  return playerNode;
}

/**
 * Moves the player node into `target`.
 * No-op if playerNode is null or already attached (React Strict Mode guard).
 */
export function attachPlayerTo(target: HTMLElement): void {
  if (!playerNode || attached) return;
  target.appendChild(playerNode);
  attached = true;
}

/**
 * Moves the player node back to the hidden host.
 * No-op if not attached or hiddenHost is missing.
 */
export function detachPlayerToHost(): void {
  if (!playerNode || !hiddenHost || !attached) return;
  hiddenHost.appendChild(playerNode);
  attached = false;
}

/** Called when the video changes or is cleared. Nulls the node and resets state. */
export function clearPlayerNode(): void {
  playerNode = null;
  attached = false;
}

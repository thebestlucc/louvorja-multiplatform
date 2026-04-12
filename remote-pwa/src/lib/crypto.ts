/**
 * HMAC-SHA256 signing for WebSocket envelopes.
 *
 * Message format (must match Rust hmac_util.rs):
 *   `{ts}|{nonce}|{op}|{payload}`
 *
 * Result: base64url-encoded (no padding) signature.
 */

/** Build the canonical message string used for signing. */
function buildMessage(ts: number, nonce: string, op: string, payload: string): string {
  return `${ts}|${nonce}|${op}|${payload}`;
}

/**
 * Base64 standard (no padding, no line breaks) — matches Rust BASE64_STANDARD_NO_PAD.
 * Uses standard alphabet (+/) not URL-safe (-_).
 */
function toBase64NoPad(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa produces standard base64 with padding — strip the padding
  return btoa(binary).replace(/=/g, "");
}

/** Import a raw byte key for HMAC-SHA256. */
async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Sign an envelope and return a base64url (no padding) signature.
 *
 * @param keyBytes  Raw token bytes (UTF-8 encoded device token string).
 * @param ts        Unix timestamp in seconds.
 * @param nonce     Random nonce string.
 * @param op        Operation name (e.g. "slide.next").
 * @param payload   JSON payload string.
 */
export async function signEnvelope(
  keyBytes: Uint8Array,
  ts: number,
  nonce: string,
  op: string,
  payload: string,
): Promise<string> {
  const key = await importKey(keyBytes);
  const message = buildMessage(ts, nonce, op, payload);
  const msgBytes = new TextEncoder().encode(message);
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return toBase64NoPad(sig);
}

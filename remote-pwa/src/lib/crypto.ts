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

// ─── Pure-JS SHA-256 + HMAC fallback ────────────────────────────────────────
// `crypto.subtle` is only defined in secure contexts (HTTPS or localhost).
// Over plain LAN HTTP it's undefined, so we ship a small JS implementation.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256(data: Uint8Array): Uint8Array {
  // Pre-processing: pad to a multiple of 64 bytes.
  const bitLen = data.length * 8;
  const padLen = (data.length + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  // Append big-endian 64-bit length (low 32 bits suffice for our message sizes).
  padded[padLen - 4] = (bitLen >>> 24) & 0xff;
  padded[padLen - 3] = (bitLen >>> 16) & 0xff;
  padded[padLen - 2] = (bitLen >>> 8) & 0xff;
  padded[padLen - 1] = bitLen & 0xff;

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);

  for (let chunk = 0; chunk < padLen; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const j = chunk + i * 4;
      W[i] = ((padded[j]! << 24) | (padded[j + 1]! << 16) | (padded[j + 2]! << 8) | padded[j + 3]!) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15]!, 7) ^ rotr(W[i - 15]!, 18) ^ (W[i - 15]! >>> 3);
      const s1 = rotr(W[i - 2]!, 17) ^ rotr(W[i - 2]!, 19) ^ (W[i - 2]! >>> 10);
      W[i] = (W[i - 16]! + s0 + W[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const temp1 = (h! + S1 + ch + K[i]! + W[i]!) >>> 0;
      const S0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const mj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e;
      e = (d! + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0]! + a!) >>> 0;
    H[1] = (H[1]! + b!) >>> 0;
    H[2] = (H[2]! + c!) >>> 0;
    H[3] = (H[3]! + d!) >>> 0;
    H[4] = (H[4]! + e!) >>> 0;
    H[5] = (H[5]! + f!) >>> 0;
    H[6] = (H[6]! + g!) >>> 0;
    H[7] = (H[7]! + h!) >>> 0;
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (H[i]! >>> 24) & 0xff;
    out[i * 4 + 1] = (H[i]! >>> 16) & 0xff;
    out[i * 4 + 2] = (H[i]! >>> 8) & 0xff;
    out[i * 4 + 3] = H[i]! & 0xff;
  }
  return out;
}

function hmacSha256Js(keyBytes: Uint8Array, msg: Uint8Array): Uint8Array {
  const blockSize = 64;
  let key = keyBytes;
  if (key.length > blockSize) key = sha256(key);
  const padded = new Uint8Array(blockSize);
  padded.set(key);
  const oKey = new Uint8Array(blockSize);
  const iKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKey[i] = padded[i]! ^ 0x5c;
    iKey[i] = padded[i]! ^ 0x36;
  }
  const inner = new Uint8Array(iKey.length + msg.length);
  inner.set(iKey);
  inner.set(msg, iKey.length);
  const innerHash = sha256(inner);
  const outer = new Uint8Array(oKey.length + innerHash.length);
  outer.set(oKey);
  outer.set(innerHash, oKey.length);
  return sha256(outer);
}

async function hmacSha256(keyBytes: Uint8Array, msgBytes: Uint8Array): Promise<Uint8Array> {
  // Prefer WebCrypto when available (faster, hardware-accelerated).
  if (typeof crypto !== "undefined" && crypto.subtle?.importKey) {
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
    return new Uint8Array(sig);
  }
  // Fallback for non-secure contexts (plain LAN HTTP).
  return hmacSha256Js(keyBytes, msgBytes);
}

/**
 * Sign an envelope and return a base64url (no padding) signature.
 *
 * @param keyBytes  Raw HMAC key bytes. For the remote-pwa device token, this
 *                  must be the base64url-DECODED raw bytes (32 bytes), not the
 *                  UTF-8 bytes of the base64url string — the server decodes the
 *                  token to raw bytes before using it as the HMAC key.
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
  const message = buildMessage(ts, nonce, op, payload);
  const msgBytes = new TextEncoder().encode(message);
  const sig = await hmacSha256(keyBytes, msgBytes);
  return toBase64NoPad(sig.buffer as ArrayBuffer);
}

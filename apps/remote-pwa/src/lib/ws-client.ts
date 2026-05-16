/**
 * RemoteWS — authenticated WebSocket client for LouvorJA Remote.
 *
 * Authentication: passes device token via WebSocket subprotocol
 * (`WebSocket(url, ["bearer", token])`), since browsers don't allow
 * custom HTTP headers during the WS upgrade.
 *
 * Signing: each outbound request envelope is HMAC-SHA256 signed.
 *
 * Reconnect: exponential backoff 1, 2, 4, 8 s (capped). Resets on success.
 *
 * Stale discard: each send increments `clientSeq`; responses older than the
 * latest acknowledged seq are dropped.
 */

import { signEnvelope } from "./crypto";
import type { WsOpName } from "./ws-ops";

/**
 * Decode a base64url (no padding) string to raw bytes.
 * The device token is delivered by the server as base64url-encoded 32 raw bytes;
 * the server uses the DECODED raw bytes as the HMAC key, so the client must
 * decode too (otherwise HMAC verification fails and all commands are rejected).
 */
function base64UrlDecode(s: string): Uint8Array {
  // Restore standard base64 alphabet + padding so atob can parse it.
  let std = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = std.length % 4;
  if (pad === 2) std += "==";
  else if (pad === 3) std += "=";
  else if (pad === 1) {
    // Malformed — atob will throw. Keep as-is so the error is visible.
  }
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type OpHandler = (payload: unknown) => void;

const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000];

/**
 * Generate a random UUID. `crypto.randomUUID` is only defined in secure
 * contexts (HTTPS or localhost); over plain LAN HTTP we fall back to
 * `crypto.getRandomValues` which IS available in all contexts.
 */
function randomUUID(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variant 10
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function nonce(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "auth_failed";

export class RemoteWS {
  private url = "";
  private tokenBytes: Uint8Array = new Uint8Array(0);
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<OpHandler>>();
  private stateHandlers = new Set<(s: ConnectionState) => void>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  private destroyed = false;
  private _state: ConnectionState = "disconnected";
  private clientSeq = 0;

  get state(): ConnectionState {
    return this._state;
  }

  private setState(s: ConnectionState) {
    this._state = s;
    for (const h of this.stateHandlers) h(s);
  }

  onStateChange(handler: (s: ConnectionState) => void) {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  /** Connect to the remote server. */
  connect(url: string, token: string) {
    this.url = url;
    // Server stores the device token as raw 32 bytes, base64url-encodes it to
    // send to the client, then base64url-decodes it on WS connect to use as
    // the HMAC key. Decode here so our HMAC key matches the server's.
    try {
      this.tokenBytes = base64UrlDecode(token);
    } catch (e) {
      // Fall back to UTF-8 bytes (matches server behaviour for malformed tokens —
      // the connection will fail cleanly at the HMAC check).
      console.error("[RemoteWS] Failed to base64url-decode device token:", e);
      this.tokenBytes = new TextEncoder().encode(token);
    }
    this.destroyed = false;
    this._openSocket(token);
  }

  private _openSocket(token: string) {
    if (this.destroyed) return;
    this.setState(this.reconnectAttempt === 0 ? "connecting" : "reconnecting");

    // Token auth via WS subprotocol (browsers forbid custom headers)
    this.ws = new WebSocket(this.url, ["bearer", token]);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState("connected");
    };

    this.ws.onmessage = (event) => {
      let msg: { type: string; op?: string; payload?: unknown };
      try {
        msg = JSON.parse(event.data as string) as typeof msg;
      } catch {
        return;
      }
      // Always-on minimal error log: if the server returns an error envelope,
      // surface it so silent rejections (bad HMAC, bad payload, unknown op)
      // never go unnoticed in the field.
      if (msg.type === "error") {
        const reason = (msg.payload as { reason?: string } | undefined)?.reason;
        if (reason === "hmac_mismatch") {
          // HMAC failure: token mismatch, clock skew, or protocol bug.
          // Surface as a distinct state so the UI can prompt re-pairing.
          console.warn("[RemoteWS] HMAC mismatch — op:", msg.op, "— may need re-pair");
          this.setState("auth_failed");
        } else {
          console.error("[RemoteWS] server error:", msg.op, msg.payload);
        }
        return; // Don't dispatch error payloads to op handlers
      }
      if (msg.op) {
        const handlers = this.handlers.get(msg.op);
        if (handlers) {
          for (const h of handlers) h(msg.payload ?? null);
        }
        // Also fire wildcard handlers
        const wildcards = this.handlers.get("*");
        if (wildcards) {
          for (const h of wildcards) h(msg);
        }
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this._state === "auth_failed") {
        // Auth failure: server broke the connection after sending hmac_mismatch.
        // Do NOT reconnect — it will keep failing. Stay in auth_failed so UI can
        // prompt the user to re-pair.
        return;
      }
      if (!this.destroyed) {
        this.setState("reconnecting");
        this._scheduleReconnect(token);
      } else {
        this.setState("disconnected");
      }
    };

    this.ws.onerror = () => {
      // onclose will be called next; nothing to do here
    };
  }

  private _scheduleReconnect(token: string) {
    clearTimeout(this.reconnectTimer);
    const delay =
      BACKOFF_SCHEDULE_MS[Math.min(this.reconnectAttempt, BACKOFF_SCHEDULE_MS.length - 1)] ??
      8000;
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this._openSocket(token);
    }, delay);
  }

  /** Register a handler for an incoming op. Returns an unsubscribe fn. */
  on(op: WsOpName, handler: OpHandler): () => void {
    if (!this.handlers.has(op)) this.handlers.set(op, new Set());
    this.handlers.get(op)!.add(handler);
    return () => this.handlers.get(op)?.delete(handler);
  }

  /**
   * Send a signed command to the server.
   * Stale commands (from a previous connection session) are NOT replayed
   * on reconnect — the caller must re-send if needed.
   */
  async send(op: WsOpName, payload: Record<string, unknown> = {}): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Drop silently; let the caller decide whether to retry
      return;
    }
    const seqAtSend = ++this.clientSeq;
    const ts = nowSecs();
    const n = nonce();
    const payloadStr = JSON.stringify(payload);
    const sig = await signEnvelope(this.tokenBytes, ts, n, op, payloadStr);

    // If the connection died while we were signing, or a newer send has since
    // incremented clientSeq past our snapshot, discard this stale envelope.
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.clientSeq !== seqAtSend) return;

    const envelope = {
      id: randomUUID(),
      type: "request",
      op,
      payload,
      ts,
      nonce: n,
      sig,
    };
    this.ws.send(JSON.stringify(envelope));
  }

  /** Disconnect and stop reconnecting. */
  disconnect() {
    this.destroyed = true;
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.setState("disconnected");
  }
}

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

type OpHandler = (payload: unknown) => void;

const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000];

function nonce(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

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
    this.tokenBytes = new TextEncoder().encode(token);
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
  on(op: string, handler: OpHandler): () => void {
    if (!this.handlers.has(op)) this.handlers.set(op, new Set());
    this.handlers.get(op)!.add(handler);
    return () => this.handlers.get(op)?.delete(handler);
  }

  /**
   * Send a signed command to the server.
   * Stale commands (from a previous connection session) are NOT replayed
   * on reconnect — the caller must re-send if needed.
   */
  async send(op: string, payload: Record<string, unknown> = {}): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Drop silently; let the caller decide whether to retry
      return;
    }
    const seq = ++this.clientSeq;
    const ts = nowSecs();
    const n = nonce();
    const payloadStr = JSON.stringify(payload);
    const sig = await signEnvelope(this.tokenBytes, ts, n, op, payloadStr);

    // If the connection died while we were signing, don't send stale
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // If a newer send has already been issued, discard this one
    if (seq < this.clientSeq) return;

    const envelope = {
      id: crypto.randomUUID(),
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

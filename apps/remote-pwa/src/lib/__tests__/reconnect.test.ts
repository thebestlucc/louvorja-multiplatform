/**
 * Phase I3 — Network loss + reconnect test.
 *
 * Drives the real RemoteWS instance to verify:
 * 1. Reconnects after abrupt socket close (code 1006).
 * 2. Exponential backoff schedule: 1s, 2s, 4s, 8s (capped).
 * 3. Manual disconnect() stops reconnection.
 * 4. Stale in-flight send() is discarded by clientSeq guard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RemoteWS } from "../ws-client";

// ── Controllable mock WebSocket ──────────────────────────────────────────────

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  /** All instances created, in order. */
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocols: string | string[];

  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;

  sentMessages: string[] = [];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols ?? [];
    MockWebSocket.instances.push(this);
  }

  /** Test helper: simulate server accepting the connection. */
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  /** Test helper: simulate network drop / server close. */
  simulateClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    const ev = new CloseEvent("close", { code, wasClean: code === 1000 });
    this.onclose?.(ev);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code: 1000, wasClean: true }));
  }

  static reset() {
    MockWebSocket.instances = [];
  }
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  MockWebSocket.reset();
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RemoteWS — reconnect after abrupt close", () => {
  it("creates a new WebSocket after onclose(1006)", () => {
    const client = new RemoteWS();
    client.connect("ws://localhost:7456/ws", "tok");

    expect(MockWebSocket.instances).toHaveLength(1);
    const first = MockWebSocket.instances[0];
    first.simulateOpen();

    // Abrupt disconnect
    first.simulateClose(1006);

    // Advance past the first backoff slot (1 s)
    vi.advanceTimersByTime(1100);

    expect(MockWebSocket.instances).toHaveLength(2);

    client.disconnect();
  });

  it("state transitions: connecting → connected → reconnecting → connecting", () => {
    const states: string[] = [];
    const client = new RemoteWS();
    client.onStateChange((s) => states.push(s));
    client.connect("ws://localhost:7456/ws", "tok");

    MockWebSocket.instances[0].simulateOpen();
    MockWebSocket.instances[0].simulateClose(1006);

    vi.advanceTimersByTime(1100);
    MockWebSocket.instances[1].simulateOpen();

    expect(states).toEqual(["connecting", "connected", "reconnecting", "reconnecting", "connected"]);

    client.disconnect();
  });
});

describe("RemoteWS — backoff schedule", () => {
  it("waits 1s, 2s, 4s, 8s between successive failures (no open = no reset)", () => {
    // onopen resets reconnectAttempt to 0, so to observe 1s→2s→4s→8s
    // we must close WITHOUT opening (connection refused scenario).
    const client = new RemoteWS();
    client.connect("ws://localhost:7456/ws", "tok");

    const expectedDelays = [1000, 2000, 4000, 8000];

    for (const delay of expectedDelays) {
      const countBefore = MockWebSocket.instances.length;
      const sock = MockWebSocket.instances[countBefore - 1];
      // Close immediately without ever opening (refused / network error)
      sock.simulateClose(1006);

      // Just under the expected delay — should NOT have reconnected yet
      vi.advanceTimersByTime(delay - 1);
      expect(MockWebSocket.instances).toHaveLength(countBefore);

      // Cross the threshold
      vi.advanceTimersByTime(2);
      expect(MockWebSocket.instances).toHaveLength(countBefore + 1);
    }

    client.disconnect();
  });

  it("caps backoff at 8s after exhausting schedule (5th failure)", () => {
    const client = new RemoteWS();
    client.connect("ws://localhost:7456/ws", "tok");

    // Burn through 4 scheduled slots without ever opening (no reset)
    const schedule = [1000, 2000, 4000, 8000];
    for (const delay of schedule) {
      MockWebSocket.instances.at(-1)!.simulateClose(1006);
      vi.advanceTimersByTime(delay + 10);
    }

    // 5th attempt: capped at 8000 (index 4 → min(4, 3) = 3 → 8000)
    const countBefore = MockWebSocket.instances.length;
    MockWebSocket.instances.at(-1)!.simulateClose(1006);

    vi.advanceTimersByTime(7999);
    expect(MockWebSocket.instances).toHaveLength(countBefore);

    vi.advanceTimersByTime(2);
    expect(MockWebSocket.instances).toHaveLength(countBefore + 1);

    client.disconnect();
  });

  it("resets backoff to 1s after a successful connection", () => {
    const client = new RemoteWS();
    client.connect("ws://localhost:7456/ws", "tok");

    // Two failures without opening: backoff reaches 2s slot (attempt=2)
    MockWebSocket.instances[0].simulateClose(1006);
    vi.advanceTimersByTime(1010); // 1s slot consumed
    MockWebSocket.instances[1].simulateClose(1006);
    vi.advanceTimersByTime(2010); // 2s slot consumed

    // Third attempt opens successfully → reconnectAttempt reset to 0
    MockWebSocket.instances[2].simulateOpen();
    // Then drops immediately
    MockWebSocket.instances[2].simulateClose(1006);

    // Should reconnect after 1s (reset), not 4s
    const countBefore = MockWebSocket.instances.length;
    vi.advanceTimersByTime(999);
    expect(MockWebSocket.instances).toHaveLength(countBefore);

    vi.advanceTimersByTime(2);
    expect(MockWebSocket.instances).toHaveLength(countBefore + 1);

    client.disconnect();
  });
});

describe("RemoteWS — manual disconnect stops reconnect", () => {
  it("does not create a new WebSocket after disconnect()", () => {
    const client = new RemoteWS();
    client.connect("ws://localhost:7456/ws", "tok");

    MockWebSocket.instances[0].simulateOpen();

    // Disconnect BEFORE simulating close
    client.disconnect();

    // The close handler fires (from ws.close() inside disconnect)
    // No reconnect timer should be scheduled
    vi.advanceTimersByTime(10_000);

    // Still only 1 instance
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("cancels a pending reconnect timer if disconnect() is called while waiting", () => {
    const client = new RemoteWS();
    client.connect("ws://localhost:7456/ws", "tok");

    MockWebSocket.instances[0].simulateOpen();
    MockWebSocket.instances[0].simulateClose(1006);

    // Reconnect is scheduled (1s). Disconnect before it fires.
    vi.advanceTimersByTime(500);
    client.disconnect();

    vi.advanceTimersByTime(1000);

    // Still only 1 instance
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(client.state).toBe("disconnected");
  });
});

describe("RemoteWS — stale command discard", () => {
  it("drops send() when socket is not OPEN (pre-connect)", async () => {
    const client = new RemoteWS();
    // No connect() call — ws is null
    await client.send("slide.next", {});
    // No instances means no send was attempted
    expect(MockWebSocket.instances).toHaveLength(0);
    client.disconnect();
  });

  it("drops send() when socket closes between async sign and actual send", async () => {
    const client = new RemoteWS();
    client.connect("ws://localhost:7456/ws", "tok");
    MockWebSocket.instances[0].simulateOpen();

    // Trigger two concurrent sends; the second increments clientSeq
    // before the first finishes the async sign step. The first is stale.
    const p1 = client.send("slide.next", {});
    const p2 = client.send("slide.prev", {});
    await Promise.all([p1, p2]);

    // Only the last send (seq === clientSeq) should have been written
    const sent = MockWebSocket.instances[0].sentMessages;
    expect(sent).toHaveLength(1);
    const envelope = JSON.parse(sent[0]) as { op: string };
    expect(envelope.op).toBe("slide.prev");

    client.disconnect();
  });
});

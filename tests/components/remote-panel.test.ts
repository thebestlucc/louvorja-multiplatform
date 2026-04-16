import { test, describe } from "node:test";
import * as assert from "node:assert";

// Stub Tauri IPC before importing anything that touches @tauri-apps/api/core.
const invokedCommands: string[] = [];

(globalThis as any).window = {
  __TAURI_INTERNALS__: {
    invoke: (cmd: string, _args?: unknown) => {
      invokedCommands.push(cmd);
      // Return a shape that matches RemoteStatus
      return Promise.resolve({
        running: true,
        ip: "192.168.1.10",
        port: 7456,
        connections: 0,
      });
    },
  },
};

// Import AFTER stubbing so bindings.ts picks up the mocked invoke.
import { commands } from "../../src/lib/bindings";

describe("RemotePanel — start_remote_server command", () => {
  test("commands.startRemoteServer invokes 'start_remote_server' over IPC", async () => {
    invokedCommands.length = 0; // reset
    const result = await commands.startRemoteServer(null);
    assert.strictEqual(result.status, "ok", "Expected ok result");
    assert.ok(
      invokedCommands.includes("start_remote_server"),
      `Expected 'start_remote_server' to be invoked, got: ${invokedCommands}`,
    );
  });

  test("commands.stopRemoteServer invokes 'stop_remote_server' over IPC", async () => {
    invokedCommands.length = 0;
    await commands.stopRemoteServer();
    assert.ok(
      invokedCommands.includes("stop_remote_server"),
      `Expected 'stop_remote_server' to be invoked, got: ${invokedCommands}`,
    );
  });

  test("commands.getRemoteStatus invokes 'get_remote_status' over IPC", async () => {
    invokedCommands.length = 0;
    await commands.getRemoteStatus();
    assert.ok(
      invokedCommands.includes("get_remote_status"),
      `Expected 'get_remote_status' to be invoked, got: ${invokedCommands}`,
    );
  });
});

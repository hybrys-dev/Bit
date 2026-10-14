import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createLogger } from "./logger.ts";
import { createCoreServer } from "./server.ts";
import { startDevWebSocket } from "./websocket.ts";

const ORIGIN = "http://localhost:1420";

function openSocket(url: string, origin?: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    socket.once("open", () => resolve(socket));
    socket.once("error", () => reject(new Error("connection rejected")));
    socket.once("unexpected-response", () => reject(new Error("connection rejected")));
  });
}

describe("dev websocket", () => {
  it("requires a loopback token and a known Origin, then serves system.health", async () => {
    const lines: string[] = [];
    const server = await startDevWebSocket({
      rpc: createCoreServer(),
      token: "test-token-value",
      allowedOrigins: [ORIGIN],
      logger: createLogger((line) => lines.push(line)),
    });
    expect(server.endpoint().startsWith("ws://127.0.0.1:")).toBe(true);

    await expect(openSocket(`ws://127.0.0.1:${server.port}/?token=test-token-value`)).rejects.toThrow(/rejected/);
    await expect(openSocket(`ws://127.0.0.1:${server.port}/?token=wrong`, ORIGIN)).rejects.toThrow(/rejected/);
    await expect(openSocket(`ws://127.0.0.1:${server.port}/?token=test-token-value&protocolVersion=1`, ORIGIN)).rejects.toThrow(/rejected/);
    expect(lines.join("")).not.toContain("test-token-value");

    const socket = await openSocket(`${server.endpoint()}&protocolVersion=0`, ORIGIN);
    const result = new Promise<unknown>((resolve, reject) => {
      socket.once("message", (data) => {
        resolve(JSON.parse(data.toString()) as unknown);
      });
      socket.once("error", reject);
    });
    socket.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "system.health", params: {} }));
    await expect(result).resolves.toMatchObject({ result: { status: "ok", protocolVersion: "0" } });
    socket.close();
    await server.dispose();
  });
});

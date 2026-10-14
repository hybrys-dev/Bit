import { JSON_RPC_ERROR } from "@bit/protocol";
import { describe, expect, it } from "vitest";
import { JsonRpcServer } from "./jsonrpc.ts";
import { createLogger } from "./logger.ts";
import { createCoreServer } from "./server.ts";

function captureLogger(): { logger: ReturnType<typeof createLogger>; text: () => string } {
  const lines: string[] = [];
  return {
    logger: createLogger((line) => lines.push(line)),
    text: () => lines.join(""),
  };
}

describe("JsonRpcServer", () => {
  it("answers system.health and rejects the rest of the protocol as not implemented", async () => {
    const server = createCoreServer(undefined, Date.now() - 25);
    const health = await server.dispatch(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "system.health", params: {} }));
    expect(health).toMatchObject({
      id: 1,
      result: { status: "ok", version: "0.0.0", protocolVersion: "0" },
    });
    expect((health?.result as { uptimeMs: number }).uptimeMs).toBeGreaterThanOrEqual(25);

    const missing = await server.dispatch(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "sessions.prompt", params: {} }));
    expect(missing?.error?.code).toBe(JSON_RPC_ERROR.methodNotFound);
  });

  it("reports parse errors, invalid params, and unsupported protocol versions", async () => {
    const server = createCoreServer();
    const parsed = await server.dispatch("{");
    expect(parsed?.error?.code).toBe(JSON_RPC_ERROR.parseError);
    const params = await server.dispatch(JSON.stringify({ jsonrpc: "2.0", id: "a", method: "system.health", params: { extra: true } }));
    expect(params?.error?.code).toBe(JSON_RPC_ERROR.invalidParams);
    const version = await server.dispatch(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "system.health", protocolVersion: "1" }));
    expect(version?.error?.code).toBe(JSON_RPC_ERROR.unsupportedProtocol);
  });

  it("does not answer notifications and redacts internal errors", async () => {
    const captured = captureLogger();
    const server = new JsonRpcServer(
      {
        "system.health": () => {
          throw new Error("token=super-secret-value");
        },
      },
      captured.logger,
    );
    const response = await server.dispatch(JSON.stringify({ jsonrpc: "2.0", id: 4, method: "system.health" }));
    expect(response?.error?.code).toBe(JSON_RPC_ERROR.internalError);
    expect(JSON.stringify(response)).not.toContain("super-secret-value");
    expect(captured.text()).not.toContain("super-secret-value");

    const notice = await server.dispatch(JSON.stringify({ jsonrpc: "2.0", method: "system.health" }));
    expect(notice).toBeUndefined();
  });
});

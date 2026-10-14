import { healthResultSchema, methodSchemas, PROTOCOL_VERSION } from "@bit/protocol";
import { JsonRpcServer } from "./jsonrpc.ts";
import type { Logger } from "./logger.ts";
import { APP_VERSION } from "./version.ts";

export function createCoreServer(logger?: Logger, startedAt = Date.now()): JsonRpcServer {
  return new JsonRpcServer(
    {
      "system.health": (params) => {
        const parsed = methodSchemas["system.health"].params.safeParse(params);
        if (!parsed.success) {
          throw parsed.error;
        }
        const result = healthResultSchema.safeParse({
          status: "ok",
          version: APP_VERSION,
          protocolVersion: PROTOCOL_VERSION,
          uptimeMs: Math.max(0, Date.now() - startedAt),
        });
        if (!result.success) {
          throw new Error("system.health result does not match the protocol");
        }
        return result.data;
      },
    },
    logger,
  );
}

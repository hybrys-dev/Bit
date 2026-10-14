import {
  JSON_RPC_ERROR,
  PROTOCOL_VERSION,
  incomingMessageSchema,
  type JsonRpcId,
} from "@bit/protocol";
import { createLogger, redact, type Logger } from "./logger.ts";

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export type RpcHandler = (params: unknown) => Promise<unknown> | unknown;

function isZodError(error: unknown): boolean {
  return error instanceof Error && error.name === "ZodError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message: redact(message) } };
}

export class JsonRpcServer {
  constructor(
    private readonly handlers: Readonly<Record<string, RpcHandler>>,
    private readonly logger: Logger = createLogger(),
  ) {}

  async handleRaw(raw: string): Promise<string | undefined> {
    const response = await this.dispatch(raw);
    return response === undefined ? undefined : JSON.stringify(response);
  }

  async dispatch(raw: string): Promise<JsonRpcResponse | undefined> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (error) {
      this.logger.error("json-rpc parse error", { detail: error instanceof Error ? error.message : "invalid json" });
      return errorResponse(null, JSON_RPC_ERROR.parseError, "Parse error");
    }
    if (!isRecord(parsed)) {
      return errorResponse(null, JSON_RPC_ERROR.invalidRequest, "Invalid request");
    }
    const id = typeof parsed.id === "string" || typeof parsed.id === "number" ? parsed.id : null;
    if ("protocolVersion" in parsed && parsed.protocolVersion !== PROTOCOL_VERSION) {
      return errorResponse(id, JSON_RPC_ERROR.unsupportedProtocol, "Unsupported protocol version");
    }
    const message = incomingMessageSchema.safeParse(parsed);
    if (!message.success || message.data.method === undefined) {
      return errorResponse(id, JSON_RPC_ERROR.invalidRequest, "Invalid request");
    }
    const isNotification = message.data.id === undefined;
    const handler = this.handlers[message.data.method];
    if (!handler) {
      this.logger.info("json-rpc method not implemented", { method: message.data.method });
      return isNotification ? undefined : errorResponse(message.data.id ?? null, JSON_RPC_ERROR.methodNotFound, "Method not found");
    }
    try {
      const result = await handler(message.data.params ?? {});
      if (isNotification) {
        return undefined;
      }
      return { jsonrpc: "2.0", id: message.data.id ?? null, result };
    } catch (error) {
      if (isNotification) {
        this.logger.error("json-rpc notification failed", {
          method: message.data.method,
          detail: error instanceof Error ? error.message : "unknown",
        });
        return undefined;
      }
      if (isZodError(error)) {
        this.logger.error("json-rpc invalid params", { method: message.data.method });
        return errorResponse(message.data.id ?? null, JSON_RPC_ERROR.invalidParams, "Invalid params");
      }
      this.logger.error("json-rpc internal error", {
        method: message.data.method,
        detail: error instanceof Error ? error.message : "unknown",
      });
      return errorResponse(message.data.id ?? null, JSON_RPC_ERROR.internalError, "Internal error");
    }
  }
}

import { z } from "zod";

export const jsonRpcIdSchema = z.union([z.string(), z.number()]);

/** Incoming JSON-RPC message. `protocolVersion` is optional; when present it must be negotiated. */
export const incomingMessageSchema = z.strictObject({
  jsonrpc: z.literal("2.0"),
  id: jsonRpcIdSchema.optional(),
  method: z.string().min(1).optional(),
  params: z.unknown().optional(),
  protocolVersion: z.string().optional(),
});

export const jsonRpcErrorObjectSchema = z.strictObject({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});

export const JSON_RPC_ERROR = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
  unsupportedProtocol: -32001,
} as const;

export type JsonRpcId = z.infer<typeof jsonRpcIdSchema>;
export type IncomingMessage = z.infer<typeof incomingMessageSchema>;

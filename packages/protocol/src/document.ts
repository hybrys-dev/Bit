import { z } from "zod";
import { incomingMessageSchema } from "./envelope.ts";
import { eventSchemas } from "./events.ts";
import { methodSchemas } from "./methods.ts";
import { PROTOCOL_VERSION } from "./version.ts";

export interface ProtocolSchemaDocument {
  protocolVersion: typeof PROTOCOL_VERSION;
  envelope: unknown;
  methods: Record<string, { params: unknown; result: unknown }>;
  events: Record<string, unknown>;
}

export function protocolSchemaDocument(): ProtocolSchemaDocument {
  const methods: ProtocolSchemaDocument["methods"] = {};
  for (const [name, schemas] of Object.entries(methodSchemas)) {
    methods[name] = {
      params: z.toJSONSchema(schemas.params),
      result: z.toJSONSchema(schemas.result),
    };
  }
  const events: ProtocolSchemaDocument["events"] = {};
  for (const [name, schema] of Object.entries(eventSchemas)) {
    events[name] = z.toJSONSchema(schema);
  }
  return {
    protocolVersion: PROTOCOL_VERSION,
    envelope: z.toJSONSchema(incomingMessageSchema),
    methods,
    events,
  };
}

export const protocolSchemaPath = new URL("../schema/bit-protocol-v0.schema.json", import.meta.url);

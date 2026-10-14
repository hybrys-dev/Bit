import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { protocolSchemaDocument, protocolSchemaPath } from "./document.ts";
import { EVENT_NAMES } from "./events.ts";
import { METHOD_NAMES } from "./methods.ts";
import { stableStringify } from "./stable-json.ts";
import { PROTOCOL_VERSION } from "./version.ts";

const REQUIRED_METHODS = [
  "agents.list",
  "agents.detect",
  "agents.add",
  "agents.doctor",
  "projects.list",
  "projects.add",
  "projects.update",
  "sessions.list",
  "sessions.create",
  "sessions.resume",
  "sessions.prompt",
  "sessions.cancel",
  "sessions.setOption",
  "sessions.close",
  "approvals.list",
  "approvals.respond",
  "chats.list",
  "chats.send",
  "chats.promote",
  "providers.list",
  "providers.upsert",
  "providers.test",
  "models.list",
  "system.health",
  "system.settings",
] as const;

const REQUIRED_EVENTS = [
  "session.update",
  "session.status",
  "approval.requested",
  "approval.resolved",
  "agent.status",
  "chat.delta",
] as const;

const SECRET_PROPERTIES = ["apiKey", "api_key", "token", "secret", "password", "authorization"];

function propertyNames(schema: unknown, found: string[] = []): string[] {
  if (!schema || typeof schema !== "object") {
    return found;
  }
  if (Array.isArray(schema)) {
    for (const item of schema) {
      propertyNames(item, found);
    }
    return found;
  }
  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const property of Object.keys(value)) {
        found.push(property);
      }
    }
    propertyNames(value, found);
  }
  return found;
}

describe("Bit Protocol v0", () => {
  it("negotiates protocol version 0", () => {
    expect(PROTOCOL_VERSION).toBe("0");
    expect(protocolSchemaDocument().protocolVersion).toBe("0");
  });

  it("covers every method and event in the architecture contract", () => {
    expect([...METHOD_NAMES].sort()).toEqual([...REQUIRED_METHODS].sort());
    expect([...EVENT_NAMES].sort()).toEqual([...REQUIRED_EVENTS].sort());
  });

  it("matches the committed JSON Schema", () => {
    const committed = readFileSync(protocolSchemaPath, "utf8");
    expect(committed).toBe(stableStringify(protocolSchemaDocument()));
  });

  it("keeps API keys write-only", () => {
    const document = protocolSchemaDocument();
    for (const name of METHOD_NAMES) {
      if (name === "providers.upsert") {
        continue;
      }
      const names = propertyNames(document.methods[name]?.result);
      for (const secret of SECRET_PROPERTIES) {
        expect(names, `${name} result`).not.toContain(secret);
      }
    }
    const upsertResult = propertyNames(document.methods["providers.upsert"]?.result);
    expect(upsertResult).not.toContain("apiKey");
    const upsertParams = propertyNames(document.methods["providers.upsert"]?.params);
    expect(upsertParams).toContain("apiKey");
  });
});

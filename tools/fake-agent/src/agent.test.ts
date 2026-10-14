import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { serveScenario } from "./agent.ts";
import { loadScenario, parseScenario, type Scenario } from "./scenario.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function linesOf(stream: PassThrough): { next: () => Promise<Record<string, unknown>> } {
  const queue: Record<string, unknown>[] = [];
  const waiters: Array<(value: Record<string, unknown>) => void> = [];
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const parsed = JSON.parse(line) as unknown;
      if (!isRecord(parsed)) {
        throw new Error("agent emitted a non-object");
      }
      const waiter = waiters.shift();
      if (waiter) {
        waiter(parsed);
      } else {
        queue.push(parsed);
      }
      newline = buffer.indexOf("\n");
    }
  });
  return {
    next: () => {
      const queued = queue.shift();
      if (queued) {
        return Promise.resolve(queued);
      }
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

const scenario: Scenario = parseScenario({
  agentInfo: { name: "fake-agent", version: "0.0.0" },
  configOptions: [
    {
      id: "model",
      name: "Model",
      category: "model",
      type: "select",
      currentValue: "fake-small",
      options: [
        { value: "fake-small", name: "Fake Small" },
        { value: "fake-large", name: "Fake Large" },
      ],
    },
  ],
  sessions: [{ sessionId: "existing-1", cwd: "/tmp/demo", title: "Existing" }],
  prompts: [
    {
      match: "run",
      steps: [
        {
          type: "update",
          update: {
            sessionUpdate: "tool_call",
            toolCallId: "call-1",
            title: "Run tests",
            kind: "execute",
            status: "pending",
          },
        },
        {
          type: "permission",
          toolCallId: "call-1",
          title: "Run tests",
          kind: "execute",
          options: [
            { optionId: "allow", name: "Allow", kind: "allow_once" },
            { optionId: "deny", name: "Deny", kind: "reject_once" },
          ],
        },
        {
          type: "update",
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "done" },
          },
        },
      ],
    },
  ],
});

describe("fake-agent", () => {
  it("lists sessions, updates config, emits tool calls, and waits for permission", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const incoming = linesOf(output);
    const done = serveScenario(scenario, input, output);

    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
    expect(await incoming.next()).toMatchObject({ id: 1, result: { agentInfo: { name: "fake-agent" } } });

    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "session/list", params: { cwd: "/tmp/demo" } })}\n`);
    expect(await incoming.next()).toMatchObject({ id: 2, result: { sessions: [{ sessionId: "existing-1" }] } });

    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "session/new", params: { cwd: "/work" } })}\n`);
    const created = await incoming.next();
    const sessionId = isRecord(created.result) && typeof created.result.sessionId === "string" ? created.result.sessionId : "";
    expect(sessionId).not.toBe("");

    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 4, method: "session/set_config_option", params: { sessionId, configId: "model", value: "fake-large" } })}\n`);
    const configured = await incoming.next();
    expect(configured).toMatchObject({ id: 4 });
    const options = isRecord(configured.result) ? configured.result.configOptions : undefined;
    expect(options).toMatchObject([{ id: "model", currentValue: "fake-large" }]);

    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 5, method: "session/prompt", params: { sessionId, prompt: [{ type: "text", text: "run the tests" }] } })}\n`);
    const toolCall = await incoming.next();
    expect(toolCall).toMatchObject({ method: "session/update", params: { update: { sessionUpdate: "tool_call", toolCallId: "call-1" } } });
    const permission = await incoming.next();
    expect(permission).toMatchObject({ method: "session/request_permission", params: { toolCall: { toolCallId: "call-1" } } });
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: permission.id, result: { outcome: { outcome: "selected", optionId: "allow" } } })}\n`);
    expect(await incoming.next()).toMatchObject({ method: "session/update", params: { update: { sessionUpdate: "agent_message_chunk" } } });
    expect(await incoming.next()).toMatchObject({ id: 5, result: { stopReason: "end_turn" } });

    input.end();
    await done;
  });

  it("rejects an invalid scenario file", () => {
    const directory = mkdtempSync(join(tmpdir(), "bit-scenario-"));
    directories.push(directory);
    const path = join(directory, "bad.json");
    writeFileSync(path, '{"prompts":[]}');
    expect(() => loadScenario(path)).toThrow(/invalid scenario/);
  });
});

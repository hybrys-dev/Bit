import { randomUUID } from "node:crypto";
import type { Readable, Writable } from "node:stream";
import { z } from "zod";
import { LinePeer } from "./line-peer.ts";
import { RpcError } from "./rpc-error.ts";
import { type ConfigOption, type ListedSession, type Scenario } from "./scenario.ts";

const cwdParams = z.looseObject({ cwd: z.string().min(1) });
const sessionParams = z.looseObject({ sessionId: z.string().min(1) });
const promptParams = z.looseObject({
  sessionId: z.string().min(1),
  prompt: z.array(z.looseObject({ type: z.string().optional(), text: z.string().optional() })),
});
const listParams = z.looseObject({ cwd: z.string().optional() });
const setConfigParams = z.looseObject({
  sessionId: z.string().min(1),
  configId: z.string().min(1),
  value: z.string(),
});

interface AgentState {
  configOptions: ConfigOption[];
  sessions: ListedSession[];
  running: Set<string>;
  cancelled: Set<string>;
  abort: Map<string, AbortController>;
}

function parseParams<T extends z.ZodType>(schema: T, params: unknown): z.output<T> {
  const parsed = schema.safeParse(params ?? {});
  if (!parsed.success) {
    throw new RpcError(-32602, "Invalid params");
  }
  return parsed.data;
}

function promptText(blocks: readonly { type?: string; text?: string }[]): string {
  let text = "";
  for (const block of blocks) {
    if (block.type === "text" && typeof block.text === "string") {
      text += block.text;
    }
  }
  return text;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms === 0 || signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function requireSession(state: AgentState, sessionId: string): ListedSession {
  const session = state.sessions.find((item) => item.sessionId === sessionId);
  if (!session) {
    throw new RpcError(-32004, "unknown session");
  }
  return session;
}

export async function serveScenario(scenario: Scenario, input: Readable, output: Writable): Promise<void> {
  const state: AgentState = {
    configOptions: scenario.configOptions.map((option) => ({ ...option, options: option.options.map((choice) => ({ ...choice })) })),
    sessions: scenario.sessions.map((session) => ({ ...session })),
    running: new Set(),
    cancelled: new Set(),
    abort: new Map(),
  };

  const peer: LinePeer = new LinePeer(input, output, {
    onNotification: (method, params) => {
      if (method !== "session/cancel") {
        return;
      }
      const parsed = sessionParams.safeParse(params ?? {});
      if (!parsed.success) {
        return;
      }
      state.cancelled.add(parsed.data.sessionId);
      state.abort.get(parsed.data.sessionId)?.abort();
    },
    onRequest: (method, params): Promise<unknown> => dispatch(scenario, state, peer, method, params),
  });
  await peer.closed;
}

async function dispatch(scenario: Scenario, state: AgentState, peer: LinePeer, method: string, params: unknown): Promise<unknown> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: scenario.protocolVersion,
        agentCapabilities: {
          loadSession: false,
          promptCapabilities: { image: false, audio: false, embeddedContext: false },
          sessionCapabilities: { list: {} },
        },
        agentInfo: scenario.agentInfo,
        authMethods: [],
      };
    case "session/new": {
      const parsed = parseParams(cwdParams, params);
      const session = { sessionId: randomUUID(), cwd: parsed.cwd, title: "New session" };
      state.sessions.push(session);
      return { sessionId: session.sessionId, configOptions: state.configOptions };
    }
    case "session/list": {
      const parsed = parseParams(listParams, params);
      const sessions = parsed.cwd === undefined ? state.sessions : state.sessions.filter((session) => session.cwd === parsed.cwd);
      return { sessions };
    }
    case "session/set_config_option": {
      const parsed = parseParams(setConfigParams, params);
      requireSession(state, parsed.sessionId);
      const option = state.configOptions.find((item) => item.id === parsed.configId);
      if (!option || !option.options.some((choice) => choice.value === parsed.value)) {
        throw new RpcError(-32602, "Invalid params");
      }
      option.currentValue = parsed.value;
      return { configOptions: state.configOptions };
    }
    case "session/prompt":
      return runPrompt(scenario, state, peer, params);
    default:
      throw new RpcError(-32601, "Method not found");
  }
}

async function runPrompt(scenario: Scenario, state: AgentState, peer: LinePeer, params: unknown): Promise<unknown> {
  const parsed = parseParams(promptParams, params);
  requireSession(state, parsed.sessionId);
  if (state.running.has(parsed.sessionId)) {
    throw new RpcError(-32002, "prompt already running");
  }
  const text = promptText(parsed.prompt);
  const rule = scenario.prompts.find((item) => text.includes(item.match));
  if (!rule) {
    throw new RpcError(-32004, "no scenario rule matched");
  }
  const controller = new AbortController();
  state.running.add(parsed.sessionId);
  state.abort.set(parsed.sessionId, controller);
  state.cancelled.delete(parsed.sessionId);
  try {
    for (const step of rule.steps) {
      if (state.cancelled.has(parsed.sessionId)) {
        return { stopReason: "cancelled" };
      }
      if (step.type === "update") {
        await delay(step.delayMs, controller.signal);
        if (state.cancelled.has(parsed.sessionId)) {
          return { stopReason: "cancelled" };
        }
        peer.notify("session/update", { sessionId: parsed.sessionId, update: step.update });
        continue;
      }
      await peer.request("session/request_permission", {
        sessionId: parsed.sessionId,
        toolCall: {
          toolCallId: step.toolCallId,
          title: step.title,
          kind: step.kind,
          status: "pending",
        },
        options: step.options,
      });
    }
    return { stopReason: state.cancelled.has(parsed.sessionId) ? "cancelled" : rule.stopReason };
  } finally {
    state.running.delete(parsed.sessionId);
    state.abort.delete(parsed.sessionId);
  }
}

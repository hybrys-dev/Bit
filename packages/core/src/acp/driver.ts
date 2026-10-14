import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { BitError } from "../errors.ts";
import { createLogger, type Logger } from "../logger.ts";
import { APP_VERSION } from "../version.ts";
import {
  initializeResultSchema,
  newSessionResultSchema,
  promptResultSchema,
  sessionUpdateSchema,
  type InitializeResult,
  type NewSessionResult,
  type PromptResult,
  type SessionUpdate,
} from "./schema.ts";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * ACP driver v0. Speaks newline-delimited JSON-RPC to a child process.
 * Phase 1 covers initialize, session/new, prompt, session/update, and cancel.
 */
export class AcpDriver {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly updateListeners = new Set<(update: SessionUpdate) => void>();
  private buffer = "";
  private disposed = false;

  private constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly logger: Logger,
  ) {
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.push(chunk));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      if (chunk.trim().length > 0) {
        this.logger.debug(chunk.trim());
      }
    });
    this.child.stdin.on("error", () => {
      // The exit handler reports a dead agent. EPIPE is expected during dispose.
    });
    this.child.on("error", (error) => {
      this.rejectAll(new BitError("acp.spawn", error.message, { cause: error }));
    });
    this.child.on("exit", (code, signal) => {
      if (!this.disposed) {
        this.rejectAll(new BitError("acp.exited", `agent exited (${signal ?? code ?? "unknown"})`));
      }
    });
  }

  static spawn(command: string, args: readonly string[], logger: Logger = createLogger()): AcpDriver {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    return new AcpDriver(child as ChildProcessWithoutNullStreams, logger);
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  async initialize(): Promise<InitializeResult> {
    const result = await this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
      clientInfo: { name: "bit", version: APP_VERSION },
    });
    return initializeResultSchema.parse(result);
  }

  async newSession(cwd: string): Promise<NewSessionResult> {
    const result = await this.request("session/new", { cwd, mcpServers: [] });
    return newSessionResultSchema.parse(result);
  }

  async prompt(sessionId: string, text: string, onUpdate: (update: SessionUpdate) => void): Promise<PromptResult> {
    const listener = (update: SessionUpdate): void => {
      if (update.sessionId === sessionId) {
        onUpdate(update);
      }
    };
    this.updateListeners.add(listener);
    try {
      const result = await this.request("session/prompt", {
        sessionId,
        prompt: [{ type: "text", text }],
      });
      return promptResultSchema.parse(result);
    } finally {
      this.updateListeners.delete(listener);
    }
  }

  cancel(sessionId: string): void {
    this.notify("session/cancel", { sessionId });
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.rejectAll(new BitError("acp.disposed", "agent driver disposed"));
    const child = this.child;
    child.stdout.removeAllListeners("data");
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    child.stdin.end();
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 1_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private request(method: string, params: unknown): Promise<unknown> {
    if (this.disposed) {
      return Promise.reject(new BitError("acp.disposed", "agent driver disposed"));
    }
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BitError("acp.timeout", `timed out waiting for ${method}`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  private notify(method: string, params: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  private write(message: unknown): void {
    if (this.disposed && isRecord(message) && "id" in message) {
      return;
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private push(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newline + 1);
      if (line.trim().length > 0) {
        this.onLine(line);
      }
      newline = this.buffer.indexOf("\n");
    }
  }

  private onLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      this.logger.error("malformed agent message");
      this.rejectAll(new BitError("acp.malformed", "malformed agent message", { cause: error }));
      return;
    }
    if (!isRecord(parsed) || parsed.jsonrpc !== "2.0") {
      this.rejectAll(new BitError("acp.malformed", "malformed agent message"));
      return;
    }
    if (typeof parsed.method === "string") {
      if (!("id" in parsed)) {
        this.onNotification(parsed.method, parsed.params);
        return;
      }
      this.write({
        jsonrpc: "2.0",
        id: parsed.id,
        error: { code: -32601, message: "Method not found" },
      });
      return;
    }
    if (typeof parsed.id !== "number") {
      this.rejectAll(new BitError("acp.malformed", "malformed agent message"));
      return;
    }
    const pending = this.pending.get(parsed.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(parsed.id);
    if ("error" in parsed) {
      pending.reject(new BitError("acp.agent", "agent returned an error"));
      return;
    }
    pending.resolve(parsed.result);
  }

  private onNotification(method: string, params: unknown): void {
    if (method !== "session/update") {
      this.logger.info("ignored agent notification", { method });
      return;
    }
    const parsed = sessionUpdateSchema.safeParse(params);
    if (!parsed.success) {
      this.logger.error("malformed session update");
      this.rejectAll(new BitError("acp.malformed", "malformed session update"));
      return;
    }
    for (const listener of this.updateListeners) {
      listener(parsed.data);
    }
  }

  private rejectAll(error: BitError): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.reject(error);
    }
  }
}

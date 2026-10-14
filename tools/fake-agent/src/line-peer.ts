import type { Readable, Writable } from "node:stream";
import { RpcError } from "./rpc-error.ts";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class LinePeer {
  private buffer = "";
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private disposed = false;
  readonly closed: Promise<void>;
  private readonly output: Writable;
  private readonly handlers: {
    onRequest: (method: string, params: unknown) => Promise<unknown>;
    onNotification: (method: string, params: unknown) => void;
  };

  constructor(
    input: Readable,
    output: Writable,
    handlers: {
      onRequest: (method: string, params: unknown) => Promise<unknown>;
      onNotification: (method: string, params: unknown) => void;
    },
  ) {
    this.output = output;
    this.handlers = handlers;
    input.setEncoding("utf8");
    input.on("data", (chunk: string) => this.push(chunk));
    this.closed = new Promise((resolve) => {
      input.on("end", () => {
        this.dispose();
        resolve();
      });
    });
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcError(-32003, "timed out waiting for the client"));
      }, 10_000);
      this.pending.set(id, { resolve, reject, timer });
    });
    this.write({ jsonrpc: "2.0", id, method, params });
    return result;
  }

  notify(method: string, params: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.reject(new RpcError(-32003, "agent stopped"));
    }
  }

  private write(message: unknown): void {
    if (!this.disposed) {
      this.output.write(`${JSON.stringify(message)}\n`);
    }
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
    } catch {
      this.write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    if (!isRecord(parsed) || parsed.jsonrpc !== "2.0") {
      this.write({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } });
      return;
    }
    if (typeof parsed.method === "string") {
      if (typeof parsed.id === "number" || typeof parsed.id === "string") {
        void this.reply(parsed.id, parsed.method, parsed.params);
        return;
      }
      this.handlers.onNotification(parsed.method, parsed.params);
      return;
    }
    if (typeof parsed.id !== "number") {
      return;
    }
    const pending = this.pending.get(parsed.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(parsed.id);
    if ("error" in parsed) {
      pending.reject(new RpcError(-32003, "client returned an error"));
      return;
    }
    pending.resolve(parsed.result);
  }

  private async reply(id: number | string, method: string, params: unknown): Promise<void> {
    try {
      const result = await this.handlers.onRequest(method, params);
      this.write({ jsonrpc: "2.0", id, result });
    } catch (error) {
      const code = error instanceof RpcError ? error.code : -32603;
      const message = error instanceof RpcError ? error.message : "Internal error";
      this.write({ jsonrpc: "2.0", id, error: { code, message } });
    }
  }
}

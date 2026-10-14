import type { Readable, Writable } from "node:stream";
import { createLogger, type Logger } from "./logger.ts";
import { JsonRpcServer } from "./jsonrpc.ts";
import { createCoreServer } from "./server.ts";

export interface LineTransport {
  dispose(): void;
}

export function attachLineServer(rpc: JsonRpcServer, input: Readable, output: Writable, logger: Logger): LineTransport {
  let buffer = "";
  const onData = (chunk: string | Buffer): void => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (line.trim().length > 0) {
        void rpc.handleRaw(line).then((response) => {
          if (response !== undefined) {
            output.write(`${response}\n`);
          }
        }).catch((error: unknown) => {
          logger.error("stdio handler failed", { detail: error instanceof Error ? error.message : "unknown" });
        });
      }
      newline = buffer.indexOf("\n");
    }
  };
  input.on("data", onData);
  return {
    dispose(): void {
      input.off("data", onData);
    },
  };
}

/** Production transport: JSON-RPC on stdio. No network port is opened. */
export async function startStdio(input: Readable = process.stdin, output: Writable = process.stdout, logger: Logger = createLogger()): Promise<void> {
  const transport = attachLineServer(createCoreServer(logger), input, output, logger);
  await new Promise<void>((resolve) => {
    input.on("end", () => {
      transport.dispose();
      resolve();
    });
  });
}

import { PassThrough } from "node:stream";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.ts";
import { createCoreServer } from "./server.ts";
import { attachLineServer } from "./stdio.ts";

function readLines(stream: PassThrough): Promise<string[]> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    let buffer = "";
    stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        lines.push(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
      if (lines.length > 0) {
        resolve(lines);
      }
    });
  });
}

describe("stdio transport", () => {
  it("answers a split line and writes nothing but protocol messages", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const lines: string[] = [];
    const logger = createLogger((line) => lines.push(line));
    const transport = attachLineServer(createCoreServer(logger), input, output, logger);
    const pending = readLines(output);
    input.write('{"jsonrpc":"2.0","id":7,"method":"system.health",');
    input.write('"params":{}}\n');
    const [response] = await pending;
    expect(JSON.parse(response ?? "")).toMatchObject({ id: 7, result: { status: "ok" } });
    expect(response).not.toContain('"level"');
    transport.dispose();
    input.end();
    await once(input, "end");
  });
});

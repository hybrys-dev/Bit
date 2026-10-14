#!/usr/bin/env node
import { redact } from "./logger.ts";
import { startStdio } from "./stdio.ts";

startStdio().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "bitd failed";
  process.stderr.write(`${redact(message)}\n`);
  process.exitCode = 1;
});

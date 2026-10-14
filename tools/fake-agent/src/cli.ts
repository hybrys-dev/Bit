#!/usr/bin/env node
import { loadScenario } from "./scenario.ts";
import { serveScenario } from "./agent.ts";

const scenarioPath = process.argv[2];
if (!scenarioPath) {
  process.stderr.write("usage: fake-agent <scenario.json>\n");
  process.exitCode = 2;
} else {
  try {
    const scenario = loadScenario(scenarioPath);
    await serveScenario(scenario, process.stdin, process.stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : "fake-agent failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
}

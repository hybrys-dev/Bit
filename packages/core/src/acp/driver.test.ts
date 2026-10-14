import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AcpDriver } from "./driver.ts";

const scenarioPath = fileURLToPath(new URL("../../../../tools/fake-agent/scenarios/driver-v0.json", import.meta.url));
const cliPath = fileURLToPath(new URL("../../../../tools/fake-agent/src/cli.ts", import.meta.url));

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("ACP driver v0", () => {
  it("initializes, opens a session, streams updates, and cancels against fake-agent", async () => {
    const driver = AcpDriver.spawn(process.execPath, [cliPath, scenarioPath]);
    try {
      const initialized = await driver.initialize();
      expect(initialized.protocolVersion).toBe(1);
      expect(initialized.agentInfo).toMatchObject({ name: "fake-agent" });

      const session = await driver.newSession("/work");
      const updates: string[] = [];
      const prompt = await driver.prompt(session.sessionId, "hello", (update) => {
        const content = update.update.content;
        if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
          updates.push(content.text);
        }
      });
      expect(prompt.stopReason).toBe("end_turn");
      expect(updates).toEqual(["Hello from fake-agent"]);

      const slowUpdates: string[] = [];
      const slow = driver.prompt(session.sessionId, "slow", (update) => {
        const content = update.update.content;
        if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
          slowUpdates.push(content.text);
        }
        driver.cancel(session.sessionId);
      });
      await expect(slow).resolves.toMatchObject({ stopReason: "cancelled" });
      expect(slowUpdates).toEqual(["starting"]);
    } finally {
      const pid = driver.pid;
      await driver.dispose();
      if (pid !== undefined) {
        expect(alive(pid)).toBe(false);
      }
    }
  });

  it("rejects malformed agent messages", async () => {
    const driver = AcpDriver.spawn(process.execPath, [
      "-e",
      'process.stdin.on("data", () => { process.stdout.write("NOPE\\n"); });',
    ]);
    try {
      await expect(driver.initialize()).rejects.toMatchObject({ code: "acp.malformed" });
    } finally {
      await driver.dispose();
    }
  });
});

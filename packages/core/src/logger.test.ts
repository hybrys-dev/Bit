import { describe, expect, it } from "vitest";
import { createLogger, redact } from "./logger.ts";

const PEM = `-----BEGIN PRIVATE KEY-----
c2VjcmV0LWtleS1tYXRlcmlhbA==
-----END PRIVATE KEY-----`;

describe("redact", () => {
  it("leaves ordinary text alone", () => {
    expect(redact("session started")).toBe("session started");
  });

  it("redacts bearer tokens, API keys, assignments, and private keys", () => {
    expect(redact("Authorization: Bearer abc.def-123")).toBe("Authorization: [redacted]");
    expect(redact("key sk-live-abcdefghijklmnopqrstuvwxyz")).toBe("key [redacted]");
    expect(redact("sk-ant-api03-abcdefghijklmnopqrstuvwxyz")).toBe("[redacted]");
    expect(redact("token=super-secret-value")).toBe("token=[redacted]");
    expect(redact(`pem ${PEM}`)).toBe("pem [redacted]");
  });
});

describe("logger", () => {
  it("redacts secrets in messages and fields", () => {
    const lines: string[] = [];
    const logger = createLogger((line) => lines.push(line));
    logger.info("using token=super-secret-value", { apiKey: "sk-live-abcdefghijklmnopqrstuvwxyz", note: "ok" });
    const text = lines.join("");
    expect(text).not.toContain("super-secret-value");
    expect(text).not.toContain("sk-live-abcdefghijklmnopqrstuvwxyz");
    expect(text).toContain("[redacted]");
    expect(text).toContain("ok");
  });
});

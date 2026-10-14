import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const protocolEntry = fileURLToPath(new URL("./packages/protocol/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@bit/protocol": protocolEntry,
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "apps/**/*.test.tsx", "tools/**/*.test.ts"],
    testTimeout: 20_000,
  },
});

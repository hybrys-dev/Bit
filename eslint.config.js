import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/target/**",
      "**/gen/**",
      "apps/desktop/src-tauri/binaries/**",
      "packages/protocol/schema/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
);

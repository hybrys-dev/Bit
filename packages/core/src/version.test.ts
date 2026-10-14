import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./version.ts";

const root = resolve(import.meta.dirname, "../../..");

describe("version", () => {
  it("matches version.txt, the root package, and the desktop shell", () => {
    expect(readFileSync(resolve(root, "version.txt"), "utf8").trim()).toBe(APP_VERSION);
    const rootPackage = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };
    expect(rootPackage.version).toBe(APP_VERSION);
    const tauri = JSON.parse(readFileSync(resolve(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8")) as { version: string };
    expect(tauri.version).toBe(APP_VERSION);
    const cargo = readFileSync(resolve(root, "apps/desktop/src-tauri/Cargo.toml"), "utf8");
    const packageSection = cargo.split("[dependencies]")[0] ?? "";
    expect(/^version = "([^"]+)"/m.exec(packageSection)?.[1]).toBe(APP_VERSION);
  });
});

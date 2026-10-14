import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const tsc = resolve(repoRoot, "node_modules/typescript/bin/tsc");
const vite = resolve(repoRoot, "apps/ui/node_modules/vite/bin/vite.js");

run(process.execPath, [tsc, "-p", "tsconfig.build.json"], resolve(repoRoot, "packages/protocol"));
run(process.execPath, [tsc, "-p", "tsconfig.build.json"], resolve(repoRoot, "packages/core"));
run(process.execPath, [vite, "build"], resolve(repoRoot, "apps/ui"));

const rustc = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
if (rustc.status !== 0 || typeof rustc.stdout !== "string") {
  process.stderr.write(rustc.stderr ?? "rustc failed\n");
  process.exit(rustc.status ?? 1);
}
const hostLine = rustc.stdout.split("\n").find((line) => line.startsWith("host: "));
if (!hostLine) {
  process.stderr.write("rustc did not report a host triple\n");
  process.exit(1);
}
const triple = hostLine.slice("host: ".length).trim();
const binariesDir = resolve(repoRoot, "apps/desktop/src-tauri/binaries");
mkdirSync(binariesDir, { recursive: true });

const sidecar = `#!${process.execPath}
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let directory = dirname(fileURLToPath(import.meta.url));
let entry = "";
for (let depth = 0; depth < 8; depth += 1) {
  const candidate = resolve(directory, "packages/core/dist/bin.js");
  if (existsSync(candidate)) {
    entry = candidate;
    break;
  }
  const parent = dirname(directory);
  if (parent === directory) {
    break;
  }
  directory = parent;
}
if (!entry) {
  process.stderr.write("bitd sidecar could not find packages/core/dist/bin.js\\n");
  process.exit(1);
}
await import(pathToFileURL(entry).href);
`;

const destination = resolve(binariesDir, `bitd-${triple}`);
writeFileSync(destination, sidecar);
chmodSync(destination, 0o755);

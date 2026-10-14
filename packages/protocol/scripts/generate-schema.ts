import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { protocolSchemaDocument, protocolSchemaPath } from "../src/document.ts";
import { stableStringify } from "../src/stable-json.ts";

const json = stableStringify(protocolSchemaDocument());
mkdirSync(dirname(protocolSchemaPath.pathname), { recursive: true });
writeFileSync(protocolSchemaPath, json);

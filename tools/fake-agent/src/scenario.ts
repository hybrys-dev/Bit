import { readFileSync } from "node:fs";
import { z } from "zod";

const configChoiceSchema = z.strictObject({
  value: z.string(),
  name: z.string(),
});

const configOptionSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  category: z.enum(["model", "thought_level", "mode", "model_config"]).optional(),
  type: z.literal("select"),
  currentValue: z.string(),
  options: z.array(configChoiceSchema).min(1),
});

const listedSessionSchema = z.strictObject({
  sessionId: z.string().min(1),
  cwd: z.string().min(1),
  title: z.string().optional(),
});

const permissionOptionSchema = z.strictObject({
  optionId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["allow_once", "allow_always", "reject_once", "reject_always"]),
});

const updateStepSchema = z.strictObject({
  type: z.literal("update"),
  delayMs: z.number().int().nonnegative().default(0),
  update: z.looseObject({
    sessionUpdate: z.string().min(1),
  }),
});

const permissionStepSchema = z.strictObject({
  type: z.literal("permission"),
  toolCallId: z.string().min(1),
  title: z.string().min(1),
  kind: z.string().min(1),
  options: z.array(permissionOptionSchema).min(1),
});

const stepSchema = z.discriminatedUnion("type", [updateStepSchema, permissionStepSchema]);

const promptRuleSchema = z.strictObject({
  match: z.string(),
  steps: z.array(stepSchema),
  stopReason: z.enum(["end_turn", "cancelled"]).default("end_turn"),
});

export const scenarioSchema = z.strictObject({
  agentInfo: z.strictObject({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  protocolVersion: z.number().int().default(1),
  configOptions: z.array(configOptionSchema).default([]),
  sessions: z.array(listedSessionSchema).default([]),
  prompts: z.array(promptRuleSchema).min(1),
});

export type Scenario = z.infer<typeof scenarioSchema>;
export type ConfigOption = z.infer<typeof configOptionSchema>;
export type ListedSession = z.infer<typeof listedSessionSchema>;
export type PromptRule = z.infer<typeof promptRuleSchema>;
export type ScenarioStep = z.infer<typeof stepSchema>;

export class ScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioError";
  }
}

export function parseScenario(value: unknown): Scenario {
  const parsed = scenarioSchema.safeParse(value);
  if (!parsed.success) {
    throw new ScenarioError("invalid scenario");
  }
  return parsed.data;
}

export function loadScenario(path: string): Scenario {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new ScenarioError(error instanceof Error ? error.message : "could not read scenario");
  }
  return parseScenario(raw);
}

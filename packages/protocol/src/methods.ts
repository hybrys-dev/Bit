import { z } from "zod";
import { PROTOCOL_VERSION } from "./version.ts";
import {
  agentSchema,
  agentTransportSchema,
  approvalDecisionSchema,
  approvalSchema,
  chatSchema,
  emptyParamsSchema,
  modelSchema,
  projectSchema,
  providerDialectSchema,
  providerSchema,
  sessionSchema,
} from "./models.ts";

export const healthResultSchema = z.strictObject({
  status: z.literal("ok"),
  version: z.string().min(1),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  uptimeMs: z.number().int().nonnegative(),
});

export const methodSchemas = {
  "agents.list": {
    params: emptyParamsSchema,
    result: z.strictObject({ agents: z.array(agentSchema) }),
  },
  "agents.detect": {
    params: emptyParamsSchema,
    result: z.strictObject({ agents: z.array(agentSchema) }),
  },
  "agents.add": {
    params: z.strictObject({
      kind: z.string().min(1),
      transport: agentTransportSchema,
      command: z.string().min(1),
    }),
    result: z.strictObject({ agent: agentSchema }),
  },
  "agents.doctor": {
    params: z.strictObject({ agentId: z.string().min(1) }),
    result: z.strictObject({
      agentId: z.string().min(1),
      ok: z.boolean(),
      notes: z.array(z.string()),
    }),
  },
  "projects.list": {
    params: emptyParamsSchema,
    result: z.strictObject({ projects: z.array(projectSchema) }),
  },
  "projects.add": {
    params: z.strictObject({
      name: z.string().min(1),
      root: z.string().min(1),
    }),
    result: z.strictObject({ project: projectSchema }),
  },
  "projects.update": {
    params: z.strictObject({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      root: z.string().min(1).optional(),
    }),
    result: z.strictObject({ project: projectSchema }),
  },
  "sessions.list": {
    params: z.strictObject({ projectId: z.string().min(1).optional() }),
    result: z.strictObject({ sessions: z.array(sessionSchema) }),
  },
  "sessions.create": {
    params: z.strictObject({
      agentId: z.string().min(1),
      projectId: z.string().min(1),
    }),
    result: z.strictObject({ session: sessionSchema }),
  },
  "sessions.resume": {
    params: z.strictObject({ sessionId: z.string().min(1) }),
    result: z.strictObject({ session: sessionSchema }),
  },
  "sessions.prompt": {
    params: z.strictObject({
      sessionId: z.string().min(1),
      text: z.string().min(1),
    }),
    result: z.strictObject({ sessionId: z.string().min(1) }),
  },
  "sessions.cancel": {
    params: z.strictObject({ sessionId: z.string().min(1) }),
    result: z.strictObject({
      sessionId: z.string().min(1),
      cancelled: z.literal(true),
    }),
  },
  "sessions.setOption": {
    params: z.strictObject({
      sessionId: z.string().min(1),
      key: z.string().min(1),
      value: z.string(),
    }),
    result: z.strictObject({
      sessionId: z.string().min(1),
      key: z.string().min(1),
      value: z.string(),
    }),
  },
  "sessions.close": {
    params: z.strictObject({ sessionId: z.string().min(1) }),
    result: z.strictObject({
      sessionId: z.string().min(1),
      closed: z.literal(true),
    }),
  },
  "approvals.list": {
    params: z.strictObject({ sessionId: z.string().min(1).optional() }),
    result: z.strictObject({ approvals: z.array(approvalSchema) }),
  },
  "approvals.respond": {
    params: z.strictObject({
      requestId: z.string().min(1),
      decision: approvalDecisionSchema,
    }),
    result: z.strictObject({
      requestId: z.string().min(1),
      decision: approvalDecisionSchema,
      idempotent: z.boolean(),
    }),
  },
  "chats.list": {
    params: emptyParamsSchema,
    result: z.strictObject({ chats: z.array(chatSchema) }),
  },
  "chats.send": {
    params: z.strictObject({
      chatId: z.string().min(1).optional(),
      text: z.string().min(1),
    }),
    result: z.strictObject({
      chatId: z.string().min(1),
      messageId: z.string().min(1),
    }),
  },
  "chats.promote": {
    params: z.strictObject({
      chatId: z.string().min(1),
      projectId: z.string().min(1),
      agentId: z.string().min(1),
    }),
    result: z.strictObject({ sessionId: z.string().min(1) }),
  },
  "providers.list": {
    params: emptyParamsSchema,
    result: z.strictObject({ providers: z.array(providerSchema) }),
  },
  "providers.upsert": {
    params: z.strictObject({
      id: z.string().min(1).optional(),
      dialect: providerDialectSchema,
      baseUrl: z.string().min(1).nullable(),
      headers: z.record(z.string(), z.string()),
      apiKey: z.string().min(1).optional(),
    }),
    result: providerSchema,
  },
  "providers.test": {
    params: z.strictObject({ id: z.string().min(1) }),
    result: z.strictObject({ ok: z.boolean() }),
  },
  "models.list": {
    params: z.strictObject({ providerId: z.string().min(1) }),
    result: z.strictObject({ models: z.array(modelSchema) }),
  },
  "system.health": {
    params: emptyParamsSchema,
    result: healthResultSchema,
  },
  "system.settings": {
    params: z.strictObject({
      values: z.record(z.string(), z.string()).optional(),
    }),
    result: z.strictObject({
      values: z.record(z.string(), z.string()),
    }),
  },
} as const;

export type MethodName = keyof typeof methodSchemas;

export const METHOD_NAMES = Object.keys(methodSchemas) as MethodName[];

export type HealthResult = z.infer<typeof healthResultSchema>;

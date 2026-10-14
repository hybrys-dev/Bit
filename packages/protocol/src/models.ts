import { z } from "zod";

export const agentTransportSchema = z.enum(["local", "ssh", "gateway"]);

export const loginStateSchema = z.enum(["unknown", "logged_in", "logged_out"]);

export const agentSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.string().min(1),
  transport: agentTransportSchema,
  command: z.string().min(1),
  version: z.string().nullable(),
  loginState: loginStateSchema,
});

export const projectSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  root: z.string().min(1),
});

export const sessionStatusSchema = z.enum(["working", "waiting_for_you", "idle", "error"]);

export const sessionSchema = z.strictObject({
  id: z.string().min(1),
  agentId: z.string().min(1),
  projectId: z.string().min(1),
  nativeSessionId: z.string().nullable(),
  title: z.string(),
  status: sessionStatusSchema,
});

export const approvalDecisionSchema = z.enum(["allow", "always", "deny"]);

export const approvalSchema = z.strictObject({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  summary: z.string(),
  options: z.array(approvalDecisionSchema),
  decision: approvalDecisionSchema.nullable(),
});

export const providerDialectSchema = z.enum([
  "openai_chat",
  "openai_responses",
  "anthropic",
  "gemini",
  "custom",
]);

/** Provider view returned to clients. The API key is never part of this object. */
export const providerSchema = z.strictObject({
  id: z.string().min(1),
  dialect: providerDialectSchema,
  baseUrl: z.string().min(1).nullable(),
  headers: z.record(z.string(), z.string()),
  keyRef: z.string().min(1).nullable(),
});

export const chatSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string(),
  model: z.string().nullable(),
});

export const modelSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
});

export const emptyParamsSchema = z.strictObject({});

export type Agent = z.infer<typeof agentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type ModelInfo = z.infer<typeof modelSchema>;

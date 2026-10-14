import { z } from "zod";
import { approvalDecisionSchema, sessionStatusSchema } from "./models.ts";

const sessionEventSchema = {
  sessionId: z.string().min(1),
  seq: z.number().int().nonnegative(),
};

export const eventSchemas = {
  "session.update": z.strictObject({
    ...sessionEventSchema,
    update: z.looseObject({
      sessionUpdate: z.string().min(1),
    }),
  }),
  "session.status": z.strictObject({
    ...sessionEventSchema,
    status: sessionStatusSchema,
  }),
  "approval.requested": z.strictObject({
    ...sessionEventSchema,
    requestId: z.string().min(1),
    summary: z.string(),
    options: z.array(approvalDecisionSchema),
  }),
  "approval.resolved": z.strictObject({
    ...sessionEventSchema,
    requestId: z.string().min(1),
    decision: approvalDecisionSchema,
  }),
  "agent.status": z.strictObject({
    ...sessionEventSchema,
    agentId: z.string().min(1),
    state: z.string().min(1),
  }),
  "chat.delta": z.strictObject({
    ...sessionEventSchema,
    chatId: z.string().min(1),
    text: z.string(),
  }),
} as const;

export type EventName = keyof typeof eventSchemas;

export const EVENT_NAMES = Object.keys(eventSchemas) as EventName[];

export type SessionUpdateEvent = z.infer<(typeof eventSchemas)["session.update"]>;
export type SessionStatusEvent = z.infer<(typeof eventSchemas)["session.status"]>;
export type ApprovalRequestedEvent = z.infer<(typeof eventSchemas)["approval.requested"]>;
export type ApprovalResolvedEvent = z.infer<(typeof eventSchemas)["approval.resolved"]>;
export type AgentStatusEvent = z.infer<(typeof eventSchemas)["agent.status"]>;
export type ChatDeltaEvent = z.infer<(typeof eventSchemas)["chat.delta"]>;

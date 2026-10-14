import { z } from "zod";

export const initializeResultSchema = z.looseObject({
  protocolVersion: z.number().int(),
  agentInfo: z
    .looseObject({
      name: z.string(),
      version: z.string(),
    })
    .optional(),
});

export const newSessionResultSchema = z.looseObject({
  sessionId: z.string().min(1),
});

export const promptResultSchema = z.looseObject({
  stopReason: z.enum(["end_turn", "max_tokens", "max_turn_requests", "refusal", "cancelled"]),
});

export const sessionUpdateSchema = z.looseObject({
  sessionId: z.string().min(1),
  update: z.looseObject({
    sessionUpdate: z.string().min(1),
  }),
});

export type InitializeResult = z.infer<typeof initializeResultSchema>;
export type NewSessionResult = z.infer<typeof newSessionResultSchema>;
export type PromptResult = z.infer<typeof promptResultSchema>;
export type SessionUpdate = z.infer<typeof sessionUpdateSchema>;

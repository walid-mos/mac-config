// src/core/validation.ts
import { z } from "zod";
var MODEL_NAME_RE = /^[a-zA-Z0-9._\/-]{1,64}$/;
var SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
var ModelAssignmentSchema = z.object({
  backend: z.enum(["claude", "opencode"]),
  model: z.string().regex(MODEL_NAME_RE, "Model name must match /^[a-zA-Z0-9._/-]{1,64}$/"),
  agent: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, "Agent name must match /^[a-zA-Z0-9_-]{1,64}$/").optional()
});
var AGENT_ROLES = ["plan", "test", "code", "review", "security", "consistency", "merge", "docs"];
var AgentRoleSchema = z.enum(AGENT_ROLES);
var ConvergenceConfigSchema = z.object({
  maxIterations: z.number().int().min(1).max(20)
});
var SwarmConfigSchema = z.object({
  models: z.object({
    agents: z.record(AgentRoleSchema, ModelAssignmentSchema),
    tagged: z.record(z.string(), ModelAssignmentSchema)
  }),
  convergence: ConvergenceConfigSchema.optional()
});
var PhaseSchema = z.enum(["init", "plan", "tdd", "code", "review", "commit", "docs"]);
var PhaseErrorSchema = z.object({
  phase: PhaseSchema,
  message: z.string(),
  timestamp: z.string()
});
var SwarmStateSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: z.string().regex(SESSION_ID_RE),
  specPath: z.string(),
  projectDir: z.string(),
  config: SwarmConfigSchema,
  currentPhase: PhaseSchema,
  currentIteration: z.number(),
  currentSpecItem: z.number(),
  totalSpecItems: z.number(),
  completedPhases: z.array(PhaseSchema),
  phaseResults: z.record(z.string(), z.unknown()),
  errors: z.array(PhaseErrorSchema),
  startedAt: z.string(),
  updatedAt: z.string()
});

export {
  ModelAssignmentSchema,
  ConvergenceConfigSchema,
  SwarmStateSchema
};

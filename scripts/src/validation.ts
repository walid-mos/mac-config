import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared regex patterns
// ---------------------------------------------------------------------------

const MODEL_NAME_RE = /^[a-zA-Z0-9._\/-]{1,64}$/
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/

// ---------------------------------------------------------------------------
// ModelAssignment schema
// ---------------------------------------------------------------------------

export const ModelAssignmentSchema = z.object({
  backend: z.enum(['claude', 'opencode']),
  model: z.string().regex(MODEL_NAME_RE, 'Model name must match /^[a-zA-Z0-9._/-]{1,64}$/'),
})

// ---------------------------------------------------------------------------
// AgentRole enum values
// ---------------------------------------------------------------------------

const AGENT_ROLES = ['plan', 'test', 'code', 'review', 'security', 'merge', 'docs'] as const

const AgentRoleSchema = z.enum(AGENT_ROLES)

// ---------------------------------------------------------------------------
// SwarmConfig schema
// ---------------------------------------------------------------------------

export const SwarmConfigSchema = z.object({
  models: z.object({
    agents: z.record(AgentRoleSchema, ModelAssignmentSchema),
    tagged: z.record(z.string(), ModelAssignmentSchema),
  }),
})

// ---------------------------------------------------------------------------
// Phase schema
// ---------------------------------------------------------------------------

const PhaseSchema = z.enum(['init', 'plan', 'tdd', 'code', 'review', 'commit', 'docs'])

// ---------------------------------------------------------------------------
// PhaseError schema
// ---------------------------------------------------------------------------

const PhaseErrorSchema = z.object({
  phase: PhaseSchema,
  message: z.string(),
  timestamp: z.string(),
})

// ---------------------------------------------------------------------------
// SwarmState schema
// ---------------------------------------------------------------------------

export const SwarmStateSchema = z.object({
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
  updatedAt: z.string(),
})

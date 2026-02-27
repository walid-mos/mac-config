import type {
  SwarmConfig,
  SwarmState,
  SessionId,
  ModelAssignment,
  AgentRole,
  Phase,
  PhaseError,
  SwarmEvent,
  SessionStartEvent,
  PhaseStartEvent,
  PhaseEndEvent,
  FileChangedEvent,
  CommitEvent,
} from '../../src/types.js'

// ---------------------------------------------------------------------------
// Model & Config factories
// ---------------------------------------------------------------------------

export function createModelAssignment(
  overrides: Partial<ModelAssignment> = {}
): ModelAssignment {
  return {
    backend: 'claude',
    model: 'opus',
    ...overrides,
  }
}

export function createSwarmConfig(
  overrides: Partial<SwarmConfig> = {}
): SwarmConfig {
  const defaultAssignment = createModelAssignment()
  return {
    models: {
      agents: {
        plan: defaultAssignment,
        test: defaultAssignment,
        code: defaultAssignment,
        review: defaultAssignment,
        security: defaultAssignment,
        merge: defaultAssignment,
        docs: defaultAssignment,
      },
      tagged: {},
      ...overrides.models,
    },
  }
}

// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------

export function createSwarmState(
  overrides: Partial<SwarmState> = {}
): SwarmState {
  return {
    schemaVersion: 1,
    sessionId: 'test-session' as SessionId,
    specPath: '/tmp/project/spec.md',
    projectDir: '/tmp/project',
    config: createSwarmConfig(),
    currentPhase: 'init',
    currentIteration: 0,
    currentSpecItem: 0,
    totalSpecItems: 0,
    completedPhases: [],
    phaseResults: {},
    errors: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Event factories
// ---------------------------------------------------------------------------

export function createSessionStartEvent(
  sessionId: SessionId,
  overrides: Partial<SessionStartEvent['data']> = {}
): SessionStartEvent {
  return {
    type: 'session:start',
    timestamp: new Date().toISOString(),
    sessionId,
    data: {
      specPath: '/tmp/project/spec.md',
      projectDir: '/tmp/project',
      ...overrides,
    },
  }
}

export function createPhaseStartEvent(
  sessionId: SessionId,
  phase: Phase = 'plan'
): PhaseStartEvent {
  return {
    type: 'phase:start',
    timestamp: new Date().toISOString(),
    sessionId,
    data: { phase },
  }
}

export function createPhaseEndEvent(
  sessionId: SessionId,
  phase: Phase = 'plan'
): PhaseEndEvent {
  return {
    type: 'phase:end',
    timestamp: new Date().toISOString(),
    sessionId,
    data: { phase, durationMs: 1000 },
  }
}

export function createFileChangedEvent(
  sessionId: SessionId,
  path = 'src/index.ts'
): FileChangedEvent {
  return {
    type: 'file:changed',
    timestamp: new Date().toISOString(),
    sessionId,
    data: { path, action: 'modified' },
  }
}

export function createCommitEvent(sessionId: SessionId): CommitEvent {
  return {
    type: 'commit',
    timestamp: new Date().toISOString(),
    sessionId,
    data: { hash: 'abc1234', message: 'feat: add feature', filesChanged: 3 },
  }
}

// ---------------------------------------------------------------------------
// PhaseError factory
// ---------------------------------------------------------------------------

export function createPhaseError(
  overrides: Partial<PhaseError> = {}
): PhaseError {
  return {
    phase: 'code',
    message: 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// TOML content builders
// ---------------------------------------------------------------------------

export function buildTomlContent(models: Record<string, { backend: string; model: string }>): string {
  const lines = ['[models]']
  for (const [key, value] of Object.entries(models)) {
    if (key.includes('-')) {
      // Tag-suffixed keys use section syntax
      lines.push('')
      lines.push(`[models.${key}]`)
      lines.push(`backend = "${value.backend}"`)
      lines.push(`model   = "${value.model}"`)
    } else {
      lines.push(`${key} = { backend = "${value.backend}", model = "${value.model}" }`)
    }
  }
  return lines.join('\n') + '\n'
}

export const FULL_TOML = buildTomlContent({
  plan: { backend: 'claude', model: 'opus' },
  test: { backend: 'opencode', model: 'gpt-5.3' },
  code: { backend: 'opencode', model: 'codex' },
  review: { backend: 'claude', model: 'opus' },
  security: { backend: 'opencode', model: 'gpt-5.3' },
  merge: { backend: 'claude', model: 'opus' },
  docs: { backend: 'opencode', model: 'kimi-k2.5' },
})

export const TOML_WITH_TAGS = buildTomlContent({
  plan: { backend: 'claude', model: 'opus' },
  test: { backend: 'claude', model: 'opus' },
  code: { backend: 'opencode', model: 'codex' },
  review: { backend: 'claude', model: 'opus' },
  security: { backend: 'claude', model: 'opus' },
  merge: { backend: 'claude', model: 'opus' },
  docs: { backend: 'claude', model: 'opus' },
  'code-frontend': { backend: 'opencode', model: 'gemini' },
  'code-backend': { backend: 'opencode', model: 'codex' },
})

export const PARTIAL_TOML = buildTomlContent({
  plan: { backend: 'opencode', model: 'gpt-5.3' },
  code: { backend: 'opencode', model: 'codex' },
})

// All base roles guaranteed by spec
export const ALL_AGENT_ROLES: readonly AgentRole[] = [
  'plan', 'test', 'code', 'review', 'security', 'merge', 'docs',
] as const

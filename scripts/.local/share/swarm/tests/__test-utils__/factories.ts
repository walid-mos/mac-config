import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { Readable, Writable, PassThrough } from 'node:stream'
import type {
  SwarmConfig,
  SwarmState,
  SessionId,
  ModelId,
  ModelAssignment,
  AgentRole,
  Phase,
  PhaseError,
  SwarmEvent,
  SwarmEventEmitter,
  SessionStartEvent,
  PhaseStartEvent,
  PhaseEndEvent,
  FileChangedEvent,
  CommitEvent,
} from '../../src/core/types.js'
import type { AgentRequest } from '../../src/drivers/driver.js'

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
        consistency: defaultAssignment,
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
    runtimeDir: '/tmp/project/.swarm/run/test-session',
    configResolvedFrom: 'builtin-defaults',
    status: 'running',
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

export function buildTomlContent(models: Record<string, { backend: string; model: string; agent?: string }>): string {
  const lines = ['[models]']
  for (const [key, value] of Object.entries(models)) {
    const agentPart = value.agent ? `, agent = "${value.agent}"` : ''
    if (key.includes('-')) {
      // Tag-suffixed keys use section syntax
      lines.push('')
      lines.push(`[models.${key}]`)
      lines.push(`backend = "${value.backend}"`)
      lines.push(`model   = "${value.model}"`)
      if (value.agent) {
        lines.push(`agent   = "${value.agent}"`)
      }
    } else {
      lines.push(`${key} = { backend = "${value.backend}", model = "${value.model}"${agentPart} }`)
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
  consistency: { backend: 'claude', model: 'opus' },
  merge: { backend: 'claude', model: 'opus' },
  docs: { backend: 'opencode', model: 'kimi-k2.5' },
})

export const TOML_WITH_TAGS = buildTomlContent({
  plan: { backend: 'claude', model: 'opus' },
  test: { backend: 'claude', model: 'opus' },
  code: { backend: 'opencode', model: 'codex' },
  review: { backend: 'claude', model: 'opus' },
  security: { backend: 'claude', model: 'opus' },
  consistency: { backend: 'claude', model: 'opus' },
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
  'plan', 'test', 'code', 'review', 'security', 'consistency', 'merge', 'docs',
] as const

// ---------------------------------------------------------------------------
// Driver factories
// ---------------------------------------------------------------------------

export function createAgentRequest(
  overrides: Partial<AgentRequest> = {}
): AgentRequest {
  return {
    prompt: 'Test prompt content',
    role: 'plan',
    model: 'opus' as ModelId,
    projectDir: '/tmp/project',
    swarmSessionId: 'test-session' as SessionId,
    ...overrides,
  }
}

/**
 * A mock emitter that captures events in an array for assertion.
 */
export function createMockEmitter(): SwarmEventEmitter & { events: SwarmEvent[] } {
  const events: SwarmEvent[] = []
  return {
    events,
    emit(event: SwarmEvent): void {
      events.push(event)
    },
    getEvents(filter?: { type?: SwarmEvent['type'] }): SwarmEvent[] {
      if (!filter?.type) return [...events]
      return events.filter(e => e.type === filter.type)
    },
  }
}

/**
 * Builds a mock ChildProcess suitable for testing driver spawn behavior.
 * Emits events via EventEmitter. stdout/stderr are PassThrough streams.
 * stdin is a PassThrough writable.
 */
export interface MockChildProcess extends EventEmitter {
  pid: number
  killed: boolean
  stdin: Writable
  stdout: Readable
  stderr: Readable
  kill: (signal?: NodeJS.Signals | number) => boolean
  /** Helper: simulate stdout data + close + exit */
  simulateOutput: (stdout: string, exitCode?: number) => void
  /** Helper: simulate a single NDJSON line on stdout (no close) */
  simulateStreamLine: (event: Record<string, unknown>) => void
  /** Helper: simulate stream-json output (NDJSON lines) + close + exit */
  simulateStreamOutput: (result: string, exitCode?: number) => void
  /** Helper: simulate stderr data */
  simulateStderr: (data: string) => void
  /** Helper: simulate exit with code */
  simulateExit: (code: number) => void
  /** Helper: simulate spawn error */
  simulateError: (err: Error) => void
}

export function createMockChildProcess(pid = 12345): MockChildProcess {
  const emitter = new EventEmitter() as MockChildProcess
  const stdoutStream = new PassThrough()
  const stderrStream = new PassThrough()
  const stdinStream = new PassThrough()

  emitter.pid = pid
  emitter.killed = false
  emitter.stdin = stdinStream
  emitter.stdout = stdoutStream
  emitter.stderr = stderrStream
  emitter.kill = (_signal?: NodeJS.Signals | number) => {
    emitter.killed = true
    return true
  }

  emitter.simulateOutput = (stdout: string, exitCode = 0) => {
    stdoutStream.write(stdout)
    stdoutStream.end()
    stderrStream.end()
    emitter.emit('close', exitCode, null)
  }

  emitter.simulateStreamLine = (event: Record<string, unknown>) => {
    stdoutStream.write(JSON.stringify(event) + '\n')
  }

  emitter.simulateStreamOutput = (result: string, exitCode = 0) => {
    stdoutStream.write(JSON.stringify({ type: 'system', subtype: 'init' }) + '\n')
    stdoutStream.write(JSON.stringify({ type: 'result', subtype: 'success', result }) + '\n')
    stdoutStream.end()
    stderrStream.end()
    emitter.emit('close', exitCode, null)
  }

  emitter.simulateStderr = (data: string) => {
    stderrStream.write(data)
  }

  emitter.simulateExit = (code: number) => {
    stdoutStream.end()
    stderrStream.end()
    emitter.emit('close', code, null)
  }

  emitter.simulateError = (err: Error) => {
    emitter.emit('error', err)
    stdoutStream.end()
    stderrStream.end()
  }

  return emitter
}

/**
 * Create a config that maps specific roles to specific backends.
 * Useful for testing the driver registry.
 */
export function createMixedBackendConfig(): SwarmConfig {
  return createSwarmConfig({
    models: {
      agents: {
        plan: { backend: 'claude', model: 'opus' },
        test: { backend: 'opencode', model: 'gpt-5.3' },
        code: { backend: 'opencode', model: 'openai/gpt-5.3-codex' },
        review: { backend: 'claude', model: 'opus' },
        security: { backend: 'opencode', model: 'gpt-5.3' },
        consistency: { backend: 'claude', model: 'opus' },
        merge: { backend: 'claude', model: 'opus' },
        docs: { backend: 'opencode', model: 'moonshot/kimi-k2.5' },
      },
      tagged: {
        'code-frontend': { backend: 'opencode', model: 'google/gemini-2.5-pro' },
        'code-backend': { backend: 'opencode', model: 'openai/gpt-5.3-codex' },
      },
    },
  })
}

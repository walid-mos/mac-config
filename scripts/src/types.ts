// === Branded Primitives ===

declare const _sessionId: unique symbol
export type SessionId = string & { readonly [_sessionId]: true }

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/

export function createSessionId(raw: string): SessionId {
  if (!SESSION_ID_RE.test(raw)) {
    throw new Error(
      `Invalid session ID "${raw}": must match /^[a-zA-Z0-9_-]{1,64}$/`
    )
  }
  return raw as SessionId
}

// === Domain Unions ===

export type AgentRole = 'plan' | 'test' | 'code' | 'review' | 'security' | 'merge' | 'docs'

export const AGENT_ROLES: readonly AgentRole[] = ['plan', 'test', 'code', 'review', 'security', 'merge', 'docs'] as const

export type ConfigRoleKey = AgentRole | `code-${string}`

export type Phase =
  | 'init'
  | 'plan'
  | 'tdd'
  | 'code'
  | 'review'
  | 'commit'
  | 'docs'

export const PHASES: readonly Phase[] = ['init', 'plan', 'tdd', 'code', 'review', 'commit', 'docs'] as const

// === Config ===

export interface ModelAssignment {
  backend: 'claude' | 'opencode'
  model: string
}

export interface SwarmConfig {
  models: {
    agents: Record<AgentRole, ModelAssignment>
    tagged: Record<string, ModelAssignment>
  }
}

export interface ResolvedConfig {
  config: SwarmConfig
  resolvedFrom: string
}

// === Events ===

export type SwarmEventType =
  | 'session:start' | 'session:end' | 'session:error'
  | 'phase:start' | 'phase:end' | 'phase:error'
  | 'agent:invoke' | 'agent:result' | 'agent:error'
  | 'test:red' | 'test:green' | 'test:fail'
  | 'iteration:start' | 'iteration:end'
  | 'review:findings'
  | 'commit'
  | 'file:changed'

export interface BaseEvent {
  type: SwarmEventType
  timestamp: string
  sessionId: SessionId
}

export interface PhaseStartEvent extends BaseEvent {
  type: 'phase:start'
  data: { phase: Phase; iteration?: number }
}

export interface PhaseEndEvent extends BaseEvent {
  type: 'phase:end'
  data: { phase: Phase; durationMs: number; taskCount?: number }
}

export interface PhaseErrorEvent extends BaseEvent {
  type: 'phase:error'
  data: { phase: Phase; reason: string }
}

export interface AgentInvokeEvent extends BaseEvent {
  type: 'agent:invoke'
  data: { role: AgentRole; backend: 'claude' | 'opencode'; model: string }
}

export interface AgentResultEvent extends BaseEvent {
  type: 'agent:result'
  data: { role: AgentRole; durationMs: number }
}

export interface AgentErrorEvent extends BaseEvent {
  type: 'agent:error'
  data: { role: AgentRole; reason: string }
}

export interface SessionStartEvent extends BaseEvent {
  type: 'session:start'
  data: { specPath: string; projectDir: string }
}

export interface SessionEndEvent extends BaseEvent {
  type: 'session:end'
  data: { success: boolean; durationMs: number }
}

export interface SessionErrorEvent extends BaseEvent {
  type: 'session:error'
  data: { reason: string }
}

export interface TestRedEvent extends BaseEvent {
  type: 'test:red'
  data: { totalTests: number; passingTests: number; failingTests: number }
}

export interface TestGreenEvent extends BaseEvent {
  type: 'test:green'
  data: { totalTests: number; passingTests: number }
}

export interface TestFailEvent extends BaseEvent {
  type: 'test:fail'
  data: { totalTests: number; failingTests: number; reason: string }
}

export interface IterationStartEvent extends BaseEvent {
  type: 'iteration:start'
  data: { iteration: number; batchCount: number }
}

export interface IterationEndEvent extends BaseEvent {
  type: 'iteration:end'
  data: { iteration: number; success: boolean }
}

export interface ReviewFindingsEvent extends BaseEvent {
  type: 'review:findings'
  data: { critical: number; important: number; suggestion: number }
}

export interface CommitEvent extends BaseEvent {
  type: 'commit'
  data: { hash: string; message: string; filesChanged: number }
}

export interface FileChangedEvent extends BaseEvent {
  type: 'file:changed'
  data: { path: string; action: 'created' | 'modified' | 'deleted' }
}

export type SwarmEvent =
  | PhaseStartEvent | PhaseEndEvent | PhaseErrorEvent
  | AgentInvokeEvent | AgentResultEvent | AgentErrorEvent
  | SessionStartEvent | SessionEndEvent | SessionErrorEvent
  | TestRedEvent | TestGreenEvent | TestFailEvent
  | IterationStartEvent | IterationEndEvent
  | ReviewFindingsEvent
  | CommitEvent
  | FileChangedEvent

// === State ===

export interface PhaseError {
  phase: Phase
  message: string
  timestamp: string
}

export interface SwarmState {
  schemaVersion: 1
  sessionId: SessionId
  specPath: string
  projectDir: string
  config: SwarmConfig
  currentPhase: Phase
  currentIteration: number
  currentSpecItem: number
  totalSpecItems: number
  completedPhases: Phase[]
  phaseResults: Partial<Record<Phase, unknown>>
  errors: PhaseError[]
  startedAt: string
  updatedAt: string
}

export type LoadResult =
  | { found: false; reason: 'missing' | 'inaccessible' }
  | { found: true; valid: true; state: SwarmState }
  | { found: true; valid: false; error: string }

// === CLI Options ===

export interface RunOptions {
  session: string
  spec: string
  projectDir: string
  config?: string
  dryRun?: boolean
}

export interface ResumeOptions {
  session: string
  projectDir: string
}

// === Auxiliary Types ===

export interface LockFile {
  pid: number
  startedAt: string
  hostname: string
}

// === Event Emitter Interface ===

export interface SwarmEventEmitter {
  emit(event: SwarmEvent): void
  getEvents(filter?: { type?: SwarmEventType }): SwarmEvent[]
}

// === State Manager Interface ===

export interface SwarmStateManager {
  load(): LoadResult
  save(state: SwarmState): void
  acquireLock(): void
  releaseLock(): void
}

// === Session Context ===

export interface SessionContext {
  sessionId: SessionId
  config: ResolvedConfig
  emitter: SwarmEventEmitter
  state: SwarmStateManager
  specPath: string
  projectDir: string
  dryRun: boolean
}

// === Exhaustiveness Helper ===

export function assertNever(x: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${x}`)
}

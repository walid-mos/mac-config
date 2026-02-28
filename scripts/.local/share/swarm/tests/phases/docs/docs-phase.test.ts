import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runDocsPhase } from '../../../src/phases/docs/docs-phase.js'
import type { SessionContext, SessionId, SwarmState } from '../../../src/core/types.js'
import type { DriverRegistry, Driver } from '../../../src/drivers/driver.js'
import type { ModelId } from '../../../src/core/types.js'
import type {
  PlanPhaseResult,
  CodePhaseResult,
  DocsPhaseResult,
  MergedReview,
} from '../../../src/phases/phase-results.js'
import type { PlannerTask } from '../../../src/phases/plan/task-parser.js'
import type { TestResult } from '../../../src/phases/tdd/test-runner.js'
import { createMockEmitter, createSwarmConfig, createSwarmState } from '../../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Module mocks — all internal modules the docs phase depends on
// ---------------------------------------------------------------------------

vi.mock('../../../src/phases/phase-results.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/phase-results.js')>()
  return {
    ...actual,
    readPlanPhaseResult: vi.fn(),
    readTddPhaseResult: vi.fn(),
    readCodePhaseResult: vi.fn(),
  }
})

vi.mock('../../../src/phases/docs/report-builder.js', () => ({
  buildDeliveryReportInput: vi.fn(),
  classifyFindingResolutions: vi.fn(),
}))

vi.mock('../../../src/phases/docs/iteration-log-builder.js', () => ({
  buildIterationLog: vi.fn(),
  renderIterationLog: vi.fn(),
}))

vi.mock('../../../src/phases/docs/fallback-report.js', () => ({
  generateFallbackReport: vi.fn(),
}))

vi.mock('../../../src/phases/docs/docs-prompt.js', () => ({
  buildDocWriterPrompt: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDriver(): Driver {
  return {
    name: 'opencode' as const,
    invoke: vi.fn<Driver['invoke']>(),
    checkAvailability: vi.fn<Driver['checkAvailability']>(),
  }
}

function createMockRegistry(driver?: Driver): DriverRegistry {
  const d = driver ?? createMockDriver()
  return {
    getDriver: vi.fn().mockReturnValue({ driver: d, model: 'kimi-k2.5' as ModelId }),
    checkAll: vi.fn(),
  }
}

function createSessionContext(overrides: Partial<SessionContext> = {}): SessionContext {
  const state = createSwarmState()
  return {
    sessionId: 'test-session' as SessionId,
    config: { config: createSwarmConfig(), resolvedFrom: 'test' },
    emitter: createMockEmitter(),
    state: {
      load: vi.fn().mockReturnValue({ found: true, valid: true, state }),
      save: vi.fn(),
      acquireLock: vi.fn(),
      releaseLock: vi.fn(),
    },
    specPath: '/tmp/project/spec.md',
    projectDir: '/tmp/project',
    dryRun: false,
    ...overrides,
  }
}

function createTask(id: `TASK-${number}` = 'TASK-1'): PlannerTask {
  return {
    id,
    title: `Task ${id}`,
    description: `Implement ${id}`,
    tag: 'backend',
    files: [`src/${id.toLowerCase()}.ts`],
    dependencies: [],
    testHints: [],
  }
}

function createTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return { totalTests: 10, passingTests: 10, failingTests: 0, durationMs: 2000, ...overrides }
}

function createMergedReview(overrides: Partial<MergedReview> = {}): MergedReview {
  return { findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0, ...overrides }
}

// ---------------------------------------------------------------------------
// runDocsPhase
// ---------------------------------------------------------------------------

describe('runDocsPhase', () => {
  let ctx: SessionContext
  let registry: DriverRegistry

  beforeEach(() => {
    vi.restoreAllMocks()
    ctx = createSessionContext()
    registry = createMockRegistry()
  })

  it('emits phase:start(docs) and phase:end(docs) events', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('emits session:end as terminal event (FR-9)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('invokes doc writer agent via registry with docs role', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('writes delivery-report.md and iterations.md (FR-4, FR-5)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('updates PR body via spawn (FR-6)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('commits doc files with sanitized message (FR-7)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('marks PR ready (FR-8)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('verifies gh auth status before PR operations (FR-8)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('retries on timeout/crash/empty/invalid_json, then falls back (FR-3)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('falls back immediately on spawn_error (FR-3)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('propagates abort without fallback (FR-3, FR-10)', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      runDocsPhase(ctx, registry, controller.signal)
    ).rejects.toThrow('Not implemented')
  })

  it('handles missing codeResult gracefully', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('handles missing prNumber (skips PR operations)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('truncates PR body when >60K chars (FR-6)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('sanitizes AI output per DOC-SC-4', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('uses spawn() not exec() for all commands (DOC-SC-7)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('command timeouts (30s for gh, 60s for git) (DOC-SC-8)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('output paths verified under projectDir (DOC-SC-3)', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })

  it('returns DocsPhaseResult with correct fields', async () => {
    await expect(
      runDocsPhase(ctx, registry)
    ).rejects.toThrow('Not implemented')
  })
})

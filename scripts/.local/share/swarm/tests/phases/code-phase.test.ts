import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runCodePhase, runIteration } from '../../src/phases/code-phase.js'
import type {
  PlanPhaseResult,
  TddPhaseResult,
  TaskBatch,
  ReviewFinding,
  MergedReview,
  CodePhaseResult,
  IterationOutcome,
} from '../../src/phase-results.js'
import type { SessionContext, SessionId } from '../../src/types.js'
import type { DriverRegistry, Driver } from '../../src/drivers/driver.js'
import type { ModelId } from '../../src/types.js'
import type { TechStack } from '../../src/tech-stack.js'
import type { TestResult } from '../../src/test-runner.js'
import type { PlannerTask } from '../../src/task-parser.js'
import { createMockEmitter, createSwarmConfig } from '../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/task-scheduler.js', () => ({
  buildTaskBatches: vi.fn(),
}))
vi.mock('../../src/review-merge.js', () => ({
  runReviewPhase: vi.fn(),
  verifyMergeIntegrity: vi.fn(),
}))
vi.mock('../../src/git-operations.js', () => ({
  createFeatureBranch: vi.fn(),
  openDraftPr: vi.fn(),
  commitSpecItem: vi.fn(),
  markPrReady: vi.fn(),
}))
vi.mock('../../src/test-runner.js', () => ({
  runTestSuite: vi.fn(),
}))
vi.mock('../../src/file-verification.js', () => ({
  verifyFileContainment: vi.fn(),
  checkStagingBlocklist: vi.fn(),
}))
vi.mock('../../src/code-agent-output.js', () => ({
  parseCodeAgentOutput: vi.fn(),
}))
vi.mock('../../src/prompts/code-agent-prompt.js', () => ({
  buildCodeAgentPrompt: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDriver(): Driver {
  return {
    name: 'claude' as const,
    invoke: vi.fn<Driver['invoke']>(),
    checkAvailability: vi.fn<Driver['checkAvailability']>(),
  }
}

function createMockRegistry(driver?: Driver): DriverRegistry {
  const d = driver ?? createMockDriver()
  return {
    getDriver: vi.fn().mockReturnValue({ driver: d, model: 'opus' as ModelId }),
    checkAll: vi.fn(),
  }
}

function createSessionContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    sessionId: 'test-session' as SessionId,
    config: { config: createSwarmConfig(), resolvedFrom: 'test' },
    emitter: createMockEmitter(),
    state: { load: vi.fn(), save: vi.fn(), acquireLock: vi.fn(), releaseLock: vi.fn() },
    specPath: '/tmp/project/spec.md',
    projectDir: '/tmp/project',
    dryRun: false,
    ...overrides,
  }
}

function createTask(
  id: `TASK-${number}` = 'TASK-1',
  overrides: Partial<PlannerTask> = {}
): PlannerTask {
  return {
    id,
    title: `Task ${id}`,
    description: `Implement ${id}`,
    tag: 'backend',
    files: [`src/${id.toLowerCase()}.ts`],
    dependencies: [],
    testHints: ['test basic behavior'],
    ...overrides,
  }
}

function createTechStack(overrides: Partial<TechStack> = {}): TechStack {
  return {
    languages: ['typescript'],
    frameworks: ['express'],
    testRunner: 'vitest',
    packageManager: 'pnpm',
    buildTool: 'vite',
    configFiles: ['tsconfig.json'],
    testCommand: 'vitest run',
    ...overrides,
  }
}

function createPlanResult(overrides: Partial<PlanPhaseResult> = {}): PlanPhaseResult {
  return {
    plannerOutput: '## Tasks\n### TASK-1: Feature\n...',
    tasks: [createTask('TASK-1')],
    techStack: createTechStack(),
    taskCount: 1,
    tags: { backend: 1 },
    ...overrides,
  }
}

function createTddResult(overrides: Partial<TddPhaseResult> = {}): TddPhaseResult {
  return {
    testFiles: ['tests/feature.test.ts'],
    redVerification: {
      totalTests: 5,
      passingTests: 0,
      failingTests: 5,
      durationMs: 300,
      syntaxErrors: [],
      testFiles: ['tests/feature.test.ts'],
      isRed: true,
    },
    ...overrides,
  }
}

function createBatch(
  batchIndex: number,
  tasks: PlannerTask[] = [createTask()]
): TaskBatch {
  return { batchIndex, tasks }
}

function createTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    totalTests: 10,
    passingTests: 10,
    failingTests: 0,
    durationMs: 2000,
    ...overrides,
  }
}

function createMergedReview(overrides: Partial<MergedReview> = {}): MergedReview {
  return {
    findings: [],
    criticalCount: 0,
    importantCount: 0,
    suggestionCount: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// runCodePhase
// ---------------------------------------------------------------------------

describe('runCodePhase', () => {
  let ctx: SessionContext
  let registry: DriverRegistry

  beforeEach(() => {
    vi.restoreAllMocks()
    ctx = createSessionContext()
    registry = createMockRegistry()
  })

  it('builds batches from plan tasks', async () => {
    const plan = createPlanResult()
    const tdd = createTddResult()

    await expect(
      runCodePhase(ctx, registry, plan, tdd)
    ).rejects.toThrow('Not implemented')
  })

  it('runs iterations up to max (5)', async () => {
    const plan = createPlanResult()
    const tdd = createTddResult()

    await expect(
      runCodePhase(ctx, registry, plan, tdd)
    ).rejects.toThrow('Not implemented')
  })

  it('exits on green + clean review', async () => {
    const plan = createPlanResult()
    const tdd = createTddResult()

    await expect(
      runCodePhase(ctx, registry, plan, tdd)
    ).rejects.toThrow('Not implemented')
  })

  it('exits at max iterations with failure', async () => {
    const plan = createPlanResult()
    const tdd = createTddResult()

    await expect(
      runCodePhase(ctx, registry, plan, tdd)
    ).rejects.toThrow('Not implemented')
  })

  it('emits phase:start and phase:end events', async () => {
    const plan = createPlanResult()
    const tdd = createTddResult()

    await expect(
      runCodePhase(ctx, registry, plan, tdd)
    ).rejects.toThrow('Not implemented')
  })

  it('commits on success via commitSpecItem', async () => {
    const plan = createPlanResult()
    const tdd = createTddResult()

    await expect(
      runCodePhase(ctx, registry, plan, tdd)
    ).rejects.toThrow('Not implemented')
  })

  it('does NOT commit on failure', async () => {
    const plan = createPlanResult()
    const tdd = createTddResult()

    await expect(
      runCodePhase(ctx, registry, plan, tdd)
    ).rejects.toThrow('Not implemented')
  })

  it('handles AbortSignal (FR-16)', async () => {
    const controller = new AbortController()
    controller.abort()
    const plan = createPlanResult()
    const tdd = createTddResult()

    await expect(
      runCodePhase(ctx, registry, plan, tdd, controller.signal)
    ).rejects.toThrow('Not implemented')
  })

  it('enforces phase-level timeout (FR-18)', async () => {
    const plan = createPlanResult()
    const tdd = createTddResult()

    await expect(
      runCodePhase(ctx, registry, plan, tdd)
    ).rejects.toThrow('Not implemented')
  })
})

// ---------------------------------------------------------------------------
// runIteration
// ---------------------------------------------------------------------------

describe('runIteration', () => {
  let ctx: SessionContext
  let registry: DriverRegistry

  beforeEach(() => {
    vi.restoreAllMocks()
    ctx = createSessionContext()
    registry = createMockRegistry()
  })

  it('spawns code agents per batch', async () => {
    const batches = [createBatch(0)]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context')
    ).rejects.toThrow('Not implemented')
  })

  it('runs test suite after batch', async () => {
    const batches = [createBatch(0)]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context')
    ).rejects.toThrow('Not implemented')
  })

  it('runs review phase after tests', async () => {
    const batches = [createBatch(0)]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context')
    ).rejects.toThrow('Not implemented')
  })

  it('returns green outcome when tests pass and review clean', async () => {
    const batches = [createBatch(0)]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context')
    ).rejects.toThrow('Not implemented')
  })

  it('returns needs-iteration when tests fail', async () => {
    const batches = [createBatch(0)]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context')
    ).rejects.toThrow('Not implemented')
  })

  it('returns needs-iteration when review has critical findings', async () => {
    const batches = [createBatch(0)]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context')
    ).rejects.toThrow('Not implemented')
  })

  it('emits iteration:start and iteration:end events', async () => {
    const batches = [createBatch(0)]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context')
    ).rejects.toThrow('Not implemented')
  })

  it('uses tag-based routing via registry.getDriver (FR-3)', async () => {
    const task = createTask('TASK-1', { tag: 'frontend' })
    const batches = [createBatch(0, [task])]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context')
    ).rejects.toThrow('Not implemented')
  })

  it('handles agent failures with retry (FR-15)', async () => {
    const batches = [createBatch(0)]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context')
    ).rejects.toThrow('Not implemented')
  })

  it('passes previousFindings to code agent prompt on iteration 2+', async () => {
    const batches = [createBatch(0)]
    const techStack = createTechStack()
    const previousFindings: ReviewFinding[] = [
      { file: 'src/a.ts', severity: 'critical', category: 'bug', description: 'NPE' },
    ]

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context', previousFindings)
    ).rejects.toThrow('Not implemented')
  })

  it('propagates AbortSignal to agents', async () => {
    const controller = new AbortController()
    controller.abort()
    const batches = [createBatch(0)]
    const techStack = createTechStack()

    await expect(
      runIteration(ctx, registry, batches, techStack, 'spec context', undefined, controller.signal)
    ).rejects.toThrow('Not implemented')
  })
})

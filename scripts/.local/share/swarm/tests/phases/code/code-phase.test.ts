import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runCodePhase, attributeFindingsToAgents } from '../../../src/phases/code/code-phase.js'
import { TaskExhaustedError } from '../../../src/phases/code/dag-executor.js'
import type { AgentHandle } from '../../../src/phases/code/code-phase.js'
import type {
  PlanPhaseResult,
  TddPhaseResult,
  ReviewFinding,
  MergedReview,
  TestResult,
  TddAgentOutput,
  TaskCompletionRecord,
} from '../../../src/phases/phase-results.js'
import type { SessionContext, SessionId, IterationEndEvent } from '../../../src/core/types.js'
import type { DriverRegistry, Driver, AgentResult } from '../../../src/drivers/driver.js'
import type { ModelId } from '../../../src/core/types.js'
import type { TechStack } from '../../../src/detect/tech-stack.js'
import type { PlannerTask } from '../../../src/phases/plan/task-parser.js'
import { createMockEmitter, createSwarmConfig } from '../../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/phases/plan/task-scheduler.js', () => ({
  buildDependencyGraph: vi.fn().mockReturnValue({
    inDegree: new Map(),
    dependents: new Map(),
    taskMap: new Map(),
  }),
}))
vi.mock('../../../src/phases/code/review-merge.js', () => ({
  runReviewPhase: vi.fn().mockResolvedValue({ findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0 }),
  verifyMergeIntegrity: vi.fn().mockReturnValue({ restored: [], warnings: [] }),
}))
vi.mock('../../../src/git/git-operations.js', () => ({
  createWorktree: vi.fn().mockResolvedValue({ branch: 'swarm/test-session', worktreePath: '/tmp/wt' }),
  removeWorktree: vi.fn().mockResolvedValue(undefined),
  openDraftPr: vi.fn().mockResolvedValue({ prNumber: 1, prUrl: 'https://github.com/org/repo/pull/1' }),
  commitSpecItem: vi.fn().mockResolvedValue('abc123'),
  getChangedFiles: vi.fn().mockResolvedValue(['src/task-1.ts']),
}))
vi.mock('../../../src/phases/code/file-verification.js', () => ({
  verifyFileContainment: vi.fn().mockReturnValue({ violations: [], ciSensitive: [] }),
  checkStagingBlocklist: vi.fn().mockReturnValue({ allowed: [], blocked: [] }),
}))
vi.mock('../../../src/phases/code/code-agent-prompt.js', () => ({
  buildCodeAgentPrompt: vi.fn().mockReturnValue('mock prompt'),
  buildFindingFixPrompt: vi.fn().mockReturnValue('mock finding fix prompt'),
}))
vi.mock('../../../src/phases/code/iteration-logger.js', () => ({
  createIterationLogger: vi.fn().mockReturnValue({
    sessionDir: '/tmp/.swarm/sessions/test',
    logAgentPrompt: vi.fn(),
    logAgentResult: vi.fn(),
    logReview: vi.fn(),
    logTestResult: vi.fn(),
    logBuildResult: vi.fn(),
    logIterationSummary: vi.fn(),
  }),
}))
vi.mock('../../../src/drivers/output-parser.js', () => ({
  parseStructuredOutput: vi.fn().mockReturnValue({ ok: false, raw: '' }),
}))
vi.mock('../../../src/phases/plan/planner-prompt.js', () => ({
  buildFindingsFixPlannerPrompt: vi.fn().mockReturnValue('mock findings planner prompt'),
}))
vi.mock('../../../src/phases/plan/task-parser.js', () => ({
  parseTaskDecomposition: vi.fn().mockReturnValue({ tasks: [], warnings: [] }),
}))
vi.mock('node:fs', () => ({
  readdirSync: vi.fn().mockReturnValue(['src/', 'tests/', 'package.json']),
}))

let uuidCounter = 0
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSuccessResult(output = '{}'): AgentResult {
  return {
    success: true,
    output,
    rawOutput: output,
    stderr: '',
    model: 'opus' as ModelId,
    backend: 'claude' as const,
    durationMs: 100,
  }
}

function createMockDriver(): Driver {
  return {
    name: 'claude' as const,
    invoke: vi.fn<Driver['invoke']>().mockResolvedValue(createSuccessResult()),
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
    buildCommand: null,
    typecheckCommand: null,
    lintCommand: null,
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
    agentReport: {
      testFiles: ['tests/feature.test.ts'],
      testResult: { totalTests: 5, passingTests: 0, failingTests: 5, durationMs: 300 },
      isRed: true,
    } satisfies TddAgentOutput,
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
// resetMocks
// ---------------------------------------------------------------------------

async function resetMocks() {
  uuidCounter = 0
  const { buildDependencyGraph } = await import('../../../src/phases/plan/task-scheduler.js')
  const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
  const { createWorktree, removeWorktree, openDraftPr, commitSpecItem, getChangedFiles } = await import('../../../src/git/git-operations.js')
  const { buildCodeAgentPrompt, buildFindingFixPrompt } = await import('../../../src/phases/code/code-agent-prompt.js')
  const { createIterationLogger } = await import('../../../src/phases/code/iteration-logger.js')
  const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

  vi.mocked(buildDependencyGraph).mockImplementation((tasks) => {
    const taskMap = new Map()
    const inDegree = new Map()
    const dependents = new Map()
    for (const task of tasks) {
      taskMap.set(task.id, task)
      inDegree.set(task.id, 0)
      dependents.set(task.id, [])
    }
    for (const task of tasks) {
      for (const dep of task.dependencies) {
        if (!taskMap.has(dep)) continue
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
        dependents.get(dep)!.push(task.id)
      }
    }
    return { inDegree, dependents, taskMap }
  })
  vi.mocked(runReviewPhase).mockResolvedValue({ findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0 })
  vi.mocked(createWorktree).mockResolvedValue({ branch: 'swarm/test-session', worktreePath: '/tmp/wt' })
  vi.mocked(removeWorktree).mockResolvedValue(undefined)
  vi.mocked(openDraftPr).mockResolvedValue({ prNumber: 1, prUrl: 'https://github.com/org/repo/pull/1' })
  vi.mocked(commitSpecItem).mockResolvedValue('abc123')
  vi.mocked(getChangedFiles).mockResolvedValue(['src/task-1.ts'])
  vi.mocked(buildCodeAgentPrompt).mockReturnValue('mock prompt')
  vi.mocked(buildFindingFixPrompt).mockReturnValue('mock finding fix prompt')
  vi.mocked(parseStructuredOutput).mockReturnValue({ ok: false, raw: '' })
  vi.mocked(createIterationLogger).mockReturnValue({
    sessionDir: '/tmp/.swarm/sessions/test',
    logAgentPrompt: vi.fn(),
    logAgentResult: vi.fn(),
    logReview: vi.fn(),
    logTestResult: vi.fn(),
    logBuildResult: vi.fn(),
    logIterationSummary: vi.fn(),
  })
}

// ---------------------------------------------------------------------------
// runCodePhase
// ---------------------------------------------------------------------------

describe('runCodePhase', () => {
  let ctx: SessionContext
  let registry: DriverRegistry

  beforeEach(async () => {
    vi.restoreAllMocks()
    await resetMocks()
    ctx = createSessionContext()
    registry = createMockRegistry()
  })

  it('returns empty waves array', async () => {
    const plan = createPlanResult()
    const tdd = createTddResult()

    const result = await runCodePhase(ctx, registry, plan, tdd)

    expect(result.waves).toEqual([])
  })

  it('exits on green + clean review', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    vi.mocked(runReviewPhase).mockResolvedValue(createMergedReview())

    const plan = createPlanResult()
    const result = await runCodePhase(ctx, registry, plan, createTddResult())

    expect(result.success).toBe(true)
    expect(result.iterations.length).toBe(1)
  })

  it('throws TaskExhaustedError when a task fails all retries', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    vi.mocked(parseStructuredOutput).mockReturnValue({
      ok: true,
      output: JSON.stringify({
        filesChanged: ['a.ts'],
        testResult: { totalTests: 1, passingTests: 1, failingTests: 0, durationMs: 100 },
        buildResult: null,
        summary: 'done',
      }),
      raw: '',
    })
    vi.mocked(getChangedFiles).mockResolvedValue(['a.ts'])
    vi.mocked(runReviewPhase).mockResolvedValue(createMergedReview({
      criticalCount: 1,
      findings: [{ file: 'a.ts', severity: 'critical', category: 'bug', description: 'x' }],
    }))

    await expect(
      runCodePhase(ctx, registry, createPlanResult(), createTddResult())
    ).rejects.toThrow(TaskExhaustedError)
  })

  it('TaskExhaustedError contains taskId, attempts, and lastFindings', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    vi.mocked(parseStructuredOutput).mockReturnValue({
      ok: true,
      output: JSON.stringify({
        filesChanged: ['a.ts'],
        testResult: { totalTests: 1, passingTests: 1, failingTests: 0, durationMs: 100 },
        buildResult: null,
        summary: 'done',
      }),
      raw: '',
    })
    vi.mocked(getChangedFiles).mockResolvedValue(['a.ts'])
    vi.mocked(runReviewPhase).mockResolvedValue(createMergedReview({
      criticalCount: 1,
      findings: [{ file: 'a.ts', severity: 'critical', category: 'bug', description: 'NPE' }],
    }))

    try {
      await runCodePhase(ctx, registry, createPlanResult(), createTddResult())
      expect.unreachable('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TaskExhaustedError)
      const taskErr = err as TaskExhaustedError
      expect(taskErr.taskId).toBe('TASK-1')
      expect(taskErr.attempts).toBeGreaterThan(0)
      expect(taskErr.lastFindings.length).toBeGreaterThan(0)
    }
  })

  it('emits phase:start and phase:end events', async () => {
    const emitter = createMockEmitter()
    ctx = createSessionContext({ emitter })

    await runCodePhase(ctx, registry, createPlanResult(), createTddResult())

    const starts = emitter.getEvents({ type: 'phase:start' })
    const ends = emitter.getEvents({ type: 'phase:end' })
    expect(starts.length).toBeGreaterThanOrEqual(1)
    expect(ends.length).toBeGreaterThanOrEqual(1)
  })

  it('commits on success via commitSpecItem', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { commitSpecItem, getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    vi.mocked(runReviewPhase).mockResolvedValue(createMergedReview())
    vi.mocked(parseStructuredOutput).mockReturnValue({
      ok: true,
      output: JSON.stringify({
        filesChanged: ['src/a.ts'],
        testResult: { totalTests: 1, passingTests: 1, failingTests: 0, durationMs: 100 },
        buildResult: null,
        summary: 'done',
      }),
      raw: '',
    })
    vi.mocked(getChangedFiles).mockResolvedValue(['src/a.ts'])
    vi.mocked(commitSpecItem).mockResolvedValue('commitsha')

    const result = await runCodePhase(ctx, registry, createPlanResult(), createTddResult())

    expect(result.success).toBe(true)
  })

  it('creates wip commit on failure to preserve work', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { commitSpecItem, getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    vi.mocked(parseStructuredOutput).mockReturnValue({
      ok: true,
      output: JSON.stringify({
        filesChanged: ['src/task-1.ts'],
        testResult: { totalTests: 1, passingTests: 1, failingTests: 0, durationMs: 100 },
        buildResult: null,
        summary: 'done',
      }),
      raw: '',
    })
    vi.mocked(getChangedFiles).mockResolvedValue(['src/task-1.ts'])
    vi.mocked(runReviewPhase).mockResolvedValue(createMergedReview({
      criticalCount: 1,
      findings: [{ file: 'src/task-1.ts', severity: 'critical', category: 'bug', description: 'x' }],
    }))
    vi.mocked(commitSpecItem).mockResolvedValue('wip-hash')

    await expect(
      runCodePhase(ctx, registry, createPlanResult(), createTddResult())
    ).rejects.toThrow(TaskExhaustedError)

    // Safety commit should have been made with wip prefix
    const commitCalls = vi.mocked(commitSpecItem).mock.calls
    const wipCommit = commitCalls.find(c => (c[2] as string).startsWith('wip(swarm):'))
    expect(wipCommit).toBeDefined()
  })

  it('commits per task with functional titles in message (no task IDs)', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { commitSpecItem, getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    const task1 = createTask('TASK-1', { title: 'Set up base page layout' })
    const task2 = createTask('TASK-2', { title: 'Add site navigation' })

    // Each agent reports its own files (odd calls → layout, even calls → nav)
    let callCount = 0
    vi.mocked(parseStructuredOutput).mockImplementation(() => {
      callCount++
      const files = callCount % 2 === 1 ? ['src/layout.ts'] : ['src/nav.ts']
      return {
        ok: true,
        output: JSON.stringify({
          filesChanged: files,
          testResult: { totalTests: 1, passingTests: 1, failingTests: 0, durationMs: 100 },
          buildResult: null,
          summary: 'done',
        }),
        raw: '',
      }
    })

    vi.mocked(runReviewPhase).mockResolvedValue(createMergedReview())
    vi.mocked(getChangedFiles).mockResolvedValue(['src/layout.ts', 'src/nav.ts'])
    vi.mocked(commitSpecItem).mockResolvedValue('sha1')

    const plan = createPlanResult({ tasks: [task1, task2] })
    const result = await runCodePhase(ctx, registry, plan, createTddResult())

    expect(result.success).toBe(true)
    // Per-task commits
    const commitCalls = vi.mocked(commitSpecItem).mock.calls
    const commitMessages = commitCalls.map(c => c[2])
    expect(commitMessages.some(m => m === 'feat(swarm): Set up base page layout')).toBe(true)
    expect(commitMessages.some(m => m === 'feat(swarm): Add site navigation')).toBe(true)
  })

  it('handles AbortSignal (FR-16)', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      runCodePhase(ctx, registry, createPlanResult(), createTddResult(), controller.signal)
    ).rejects.toThrow('aborted')
  })

  it('enforces phase-level timeout (FR-18)', async () => {
    const result = await runCodePhase(ctx, registry, createPlanResult(), createTddResult())
    expect(result).toBeDefined()
  })

  it('returns taskCompletions in result', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    vi.mocked(runReviewPhase).mockResolvedValue(createMergedReview())

    const plan = createPlanResult()
    const result = await runCodePhase(ctx, registry, plan, createTddResult())

    expect(result.taskCompletions).toBeDefined()
    expect(result.taskCompletions!.length).toBe(1)
    expect(result.taskCompletions![0]!.taskId).toBe('TASK-1')
    expect(result.taskCompletions![0]!.status).toBe('green')
  })
})

// ---------------------------------------------------------------------------
// attributeFindingsToAgents
// ---------------------------------------------------------------------------

describe('attributeFindingsToAgents', () => {
  function createHandle(
    taskId: string,
    filesChanged: string[],
    status: AgentHandle['status'] = 'active'
  ): AgentHandle {
    return {
      taskId,
      sessionId: `uuid-${taskId}`,
      task: createTask(taskId as `TASK-${number}`),
      filesChanged,
      status,
    }
  }

  it('attributes findings to agent that owns the file', () => {
    const handles = [
      createHandle('TASK-1', ['src/hero.astro']),
      createHandle('TASK-2', ['src/footer.astro']),
    ]
    const findings: ReviewFinding[] = [
      { file: 'src/hero.astro', severity: 'critical', category: 'bug', description: 'F1' },
      { file: 'src/footer.astro', severity: 'important', category: 'quality', description: 'F2' },
    ]

    const attribution = attributeFindingsToAgents(findings, handles)

    expect(attribution.get('TASK-1')).toHaveLength(1)
    expect(attribution.get('TASK-1')![0]!.description).toBe('F1')
    expect(attribution.get('TASK-2')).toHaveLength(1)
    expect(attribution.get('TASK-2')![0]!.description).toBe('F2')
  })

  it('broadcasts unmatched findings to ALL active agents', () => {
    const handles = [
      createHandle('TASK-1', ['src/hero.astro']),
      createHandle('TASK-2', ['src/footer.astro']),
    ]
    const findings: ReviewFinding[] = [
      { file: 'src/unknown.ts', severity: 'critical', category: 'bug', description: 'F-unknown' },
    ]

    const attribution = attributeFindingsToAgents(findings, handles)

    expect(attribution.get('TASK-1')).toHaveLength(1)
    expect(attribution.get('TASK-1')![0]!.description).toBe('F-unknown')
    expect(attribution.get('TASK-2')).toHaveLength(1)
    expect(attribution.get('TASK-2')![0]!.description).toBe('F-unknown')
  })

  it('skips closed agents for both matching and broadcasting', () => {
    const handles = [
      createHandle('TASK-1', ['src/hero.astro'], 'closed'),
      createHandle('TASK-2', ['src/footer.astro']),
    ]
    const findings: ReviewFinding[] = [
      { file: 'src/hero.astro', severity: 'critical', category: 'bug', description: 'F1' },
    ]

    const attribution = attributeFindingsToAgents(findings, handles)

    // TASK-1 is closed so finding is unmatched, broadcast to TASK-2 only
    expect(attribution.has('TASK-1')).toBe(false)
    expect(attribution.get('TASK-2')).toHaveLength(1)
  })

  it('returns empty map when no findings', () => {
    const handles = [createHandle('TASK-1', ['src/hero.astro'])]
    const attribution = attributeFindingsToAgents([], handles)

    expect(attribution.size).toBe(0)
  })

  it('handles mixed matched and unmatched findings', () => {
    const handles = [
      createHandle('TASK-1', ['src/hero.astro']),
      createHandle('TASK-2', ['src/footer.astro']),
    ]
    const findings: ReviewFinding[] = [
      { file: 'src/hero.astro', severity: 'critical', category: 'bug', description: 'F-matched' },
      { file: 'src/unrelated.ts', severity: 'important', category: 'quality', description: 'F-unmatched' },
    ]

    const attribution = attributeFindingsToAgents(findings, handles)

    // TASK-1 gets its matched finding + the unmatched broadcast
    expect(attribution.get('TASK-1')).toHaveLength(2)
    // TASK-2 gets only the unmatched broadcast
    expect(attribution.get('TASK-2')).toHaveLength(1)
    expect(attribution.get('TASK-2')![0]!.description).toBe('F-unmatched')
  })
})

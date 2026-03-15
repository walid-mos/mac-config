import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeDag } from '../../../src/phases/code/dag-executor.js'
import type { TaskNode } from '../../../src/phases/code/dag-executor.js'
import type {
  MergedReview,
  TestResult,
  GitState,
} from '../../../src/phases/phase-results.js'
import type { SessionContext, SessionId } from '../../../src/core/types.js'
import type { DriverRegistry, Driver, AgentResult } from '../../../src/drivers/driver.js'
import type { ModelId } from '../../../src/core/types.js'
import type { TechStack } from '../../../src/detect/tech-stack.js'
import type { PlannerTask } from '../../../src/phases/plan/task-parser.js'
import { createMockEmitter, createSwarmConfig, createSwarmState } from '../../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/phases/code/review-merge.js', () => ({
  runReviewPhase: vi.fn().mockResolvedValue({ findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0 }),
}))
vi.mock('../../../src/git/git-operations.js', () => ({
  commitSpecItem: vi.fn().mockResolvedValue('abc123'),
  getChangedFiles: vi.fn().mockResolvedValue(['src/task-1.ts']),
}))
vi.mock('../../../src/phases/code/code-agent-prompt.js', () => ({
  buildCodeAgentPrompt: vi.fn().mockReturnValue('mock prompt'),
  buildFindingFixPrompt: vi.fn().mockReturnValue('mock finding fix prompt'),
}))
vi.mock('../../../src/phases/tdd/tdd-phase.js', () => ({
  runTddForTasks: vi.fn().mockResolvedValue({ testFiles: ['tests/feature.test.ts'], agentReport: { testFiles: ['tests/feature.test.ts'], testResult: { totalTests: 3, passingTests: 0, failingTests: 3, durationMs: 100 }, isRed: true } }),
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

function createMergedReview(overrides: Partial<MergedReview> = {}): MergedReview {
  return {
    findings: [],
    criticalCount: 0,
    importantCount: 0,
    suggestionCount: 0,
    ...overrides,
  }
}

function createMockLogger() {
  return {
    sessionDir: '/tmp/.swarm/sessions/test',
    logAgentPrompt: vi.fn(),
    logAgentResult: vi.fn(),
    logReview: vi.fn(),
    logTestResult: vi.fn(),
    logBuildResult: vi.fn(),
    logIterationSummary: vi.fn(),
  }
}

function createGitState(): GitState {
  return { branch: 'swarm/test-session', commits: [] }
}

async function resetMocks() {
  uuidCounter = 0
  const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
  const { commitSpecItem, getChangedFiles } = await import('../../../src/git/git-operations.js')
  const { buildCodeAgentPrompt, buildFindingFixPrompt } = await import('../../../src/phases/code/code-agent-prompt.js')
  const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')
  const { runTddForTasks } = await import('../../../src/phases/tdd/tdd-phase.js')

  vi.mocked(runReviewPhase).mockResolvedValue(createMergedReview())
  vi.mocked(commitSpecItem).mockResolvedValue('abc123')
  vi.mocked(getChangedFiles).mockResolvedValue(['src/task-1.ts'])
  vi.mocked(buildCodeAgentPrompt).mockReturnValue('mock prompt')
  vi.mocked(buildFindingFixPrompt).mockReturnValue('mock finding fix prompt')
  vi.mocked(parseStructuredOutput).mockReturnValue({ ok: false, raw: '' })
  vi.mocked(runTddForTasks).mockResolvedValue({
    testFiles: ['tests/feature.test.ts'],
    agentReport: { testFiles: ['tests/feature.test.ts'], testResult: { totalTests: 3, passingTests: 0, failingTests: 3, durationMs: 100 }, isRed: true },
  })
}

// ---------------------------------------------------------------------------
// executeDag
// ---------------------------------------------------------------------------

describe('executeDag', () => {
  let ctx: SessionContext
  let registry: DriverRegistry

  beforeEach(async () => {
    vi.restoreAllMocks()
    await resetMocks()
    ctx = createSessionContext()
    registry = createMockRegistry()
  })

  it('returns immediately for empty task list', async () => {
    const result = await executeDag(
      ctx, registry, [], createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(result.taskCompletions).toEqual([])
    expect(result.iterations).toEqual([])
    expect(result.terminalStatus).toBe('green')
    expect(result.lastOutcome).toBeUndefined()
  })

  it('executes single task and goes green on clean review', async () => {
    const tasks = [createTask('TASK-1')]

    const result = await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(result.taskCompletions).toHaveLength(1)
    expect(result.taskCompletions[0]!.status).toBe('green')
    expect(result.taskCompletions[0]!.taskId).toBe('TASK-1')
    expect(result.iterations).toHaveLength(1)
    expect(result.terminalStatus).toBe('green')
  })

  it('executes linear chain A→B→C in 3 waves', async () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', { dependencies: ['TASK-1'] }),
      createTask('TASK-3', { dependencies: ['TASK-2'] }),
    ]

    const result = await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(result.taskCompletions).toHaveLength(3)
    expect(result.taskCompletions.every(tc => tc.status === 'green')).toBe(true)
    // 3 waves: TASK-1, then TASK-2, then TASK-3
    expect(result.iterations).toHaveLength(3)
  })

  it('executes diamond A→B,C→D: B+C parallel, D after both green', async () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', { dependencies: ['TASK-1'] }),
      createTask('TASK-3', { dependencies: ['TASK-1'] }),
      createTask('TASK-4', { dependencies: ['TASK-2', 'TASK-3'] }),
    ]

    const emitter = createMockEmitter()
    ctx = createSessionContext({ emitter })

    const result = await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(result.taskCompletions).toHaveLength(4)
    expect(result.taskCompletions.every(tc => tc.status === 'green')).toBe(true)
    // 3 waves: TASK-1, then TASK-2+TASK-3, then TASK-4
    expect(result.iterations).toHaveLength(3)

    // Verify wave 2 had 2 tasks
    const iterStarts = emitter.getEvents({ type: 'iteration:start' })
    const wave2 = iterStarts[1] as { data: { taskCount: number; taskIds?: string[] } }
    expect(wave2.data.taskCount).toBe(2)
    expect(wave2.data.taskIds).toContain('TASK-2')
    expect(wave2.data.taskIds).toContain('TASK-3')
  })

  it('runs independent tasks all in wave 1', async () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2'),
      createTask('TASK-3'),
    ]

    const emitter = createMockEmitter()
    ctx = createSessionContext({ emitter })

    const result = await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(result.taskCompletions).toHaveLength(3)
    // All in one wave
    expect(result.iterations).toHaveLength(1)

    const iterStarts = emitter.getEvents({ type: 'iteration:start' })
    expect(iterStarts).toHaveLength(1)
    const wave1 = iterStarts[0] as { data: { taskCount: number } }
    expect(wave1.data.taskCount).toBe(3)
  })

  it('mixed convergence: TASK-1 green, TASK-2 needs fix, TASK-3 (depends on 1) starts alongside fix', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2'),
      createTask('TASK-3', { dependencies: ['TASK-1'] }),
    ]

    // Each agent reports DIFFERENT files so attribution routes correctly
    let parseCallCount = 0
    vi.mocked(parseStructuredOutput).mockImplementation(() => {
      parseCallCount++
      // Odd calls → TASK-1 files, even calls → TASK-2 files
      const files = parseCallCount % 2 === 1 ? ['src/task1.ts'] : ['src/task2.ts']
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
    vi.mocked(getChangedFiles).mockResolvedValue(['src/task1.ts', 'src/task2.ts'])

    // Wave 1: TASK-1 and TASK-2 run. Finding on TASK-2's file only.
    // Wave 2: TASK-2 converges (fix iteration) + TASK-3 starts (TASK-1 green)
    vi.mocked(runReviewPhase)
      .mockResolvedValueOnce(createMergedReview({
        criticalCount: 1,
        findings: [{ file: 'src/task2.ts', severity: 'critical', category: 'bug', description: 'NPE in TASK-2' }],
      }))
      .mockResolvedValueOnce(createMergedReview()) // wave 2 clean

    const emitter = createMockEmitter()
    ctx = createSessionContext({ emitter })

    const result = await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(result.taskCompletions).toHaveLength(3)
    expect(result.taskCompletions.every(tc => tc.status === 'green')).toBe(true)
    // Wave 1: TASK-1 + TASK-2, Wave 2: TASK-2 (fix) + TASK-3 (newly ready)
    expect(result.iterations).toHaveLength(2)

    // Verify wave 2 had TASK-2 (converging) and TASK-3 (newly ready)
    const iterStarts = emitter.getEvents({ type: 'iteration:start' })
    const wave2 = iterStarts[1] as { data: { taskIds?: string[] } }
    expect(wave2.data.taskIds).toContain('TASK-3')
  })

  it('propagates abort signal', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      executeDag(
        ctx, registry, [createTask('TASK-1')], createTechStack(),
        'planner output', controller.signal, createMockLogger(), createGitState()
      )
    ).rejects.toThrow('aborted')
  })

  it('commits per-task with feat(swarm) prefix for green tasks', async () => {
    const { commitSpecItem, getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

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
    vi.mocked(commitSpecItem).mockResolvedValue('commit-hash-1')

    const tasks = [createTask('TASK-1', { title: 'Implement login form' })]
    const gitState = createGitState()

    await executeDag(
      ctx, registry, tasks, createTechStack(), [], undefined, createMockLogger(), gitState
    )

    expect(commitSpecItem).toHaveBeenCalledWith(
      '/tmp/project',
      ['src/a.ts'],
      'feat(swarm): Implement login form'
    )
    expect(gitState.commits).toHaveLength(1)
    expect(gitState.commits[0]!.hash).toBe('commit-hash-1')
    expect(gitState.commits[0]!.message).toBe('feat(swarm): Implement login form')
  })

  it('emits iteration:start with taskIds and iteration:end events per wave', async () => {
    const emitter = createMockEmitter()
    ctx = createSessionContext({ emitter })

    const tasks = [createTask('TASK-1'), createTask('TASK-2')]

    await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    const starts = emitter.getEvents({ type: 'iteration:start' })
    const ends = emitter.getEvents({ type: 'iteration:end' })
    expect(starts).toHaveLength(1)
    expect(ends).toHaveLength(1)

    const start = starts[0] as { data: { taskIds?: string[]; taskCount: number } }
    expect(start.data.taskIds).toEqual(['TASK-1', 'TASK-2'])
    expect(start.data.taskCount).toBe(2)
  })

  it('emits commit events for green tasks', async () => {
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')

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

    const emitter = createMockEmitter()
    ctx = createSessionContext({ emitter })

    await executeDag(
      ctx, registry, [createTask('TASK-1')], createTechStack(),
      [], undefined, createMockLogger(), createGitState()
    )

    const commits = emitter.getEvents({ type: 'commit' })
    expect(commits.length).toBeGreaterThanOrEqual(1)
  })

  it('accumulates per-task decision log entries across iterations', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')
    const { buildFindingFixPrompt } = await import('../../../src/phases/code/code-agent-prompt.js')

    ctx = createSessionContext()

    const tasks = [createTask('TASK-1')]

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

    // Iteration 1: finding, iteration 2: green
    vi.mocked(runReviewPhase)
      .mockResolvedValueOnce(createMergedReview({
        criticalCount: 1,
        findings: [{ file: 'src/a.ts', severity: 'critical', category: 'bug', description: 'NPE' }],
      }))
      .mockResolvedValueOnce(createMergedReview()) // green

    await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    // buildFindingFixPrompt should be called with decision log on second iteration
    const fixCalls = vi.mocked(buildFindingFixPrompt).mock.calls
    expect(fixCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('uses tag-based routing via registry.getDriver', async () => {
    const tasks = [createTask('TASK-1', { tag: 'frontend' })]

    await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(registry.getDriver).toHaveBeenCalledWith('code', 'frontend')
  })

  it('calls runTddForTasks per-wave with pending tasks only', async () => {
    const { runTddForTasks } = await import('../../../src/phases/tdd/tdd-phase.js')

    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', { dependencies: ['TASK-1'] }),
    ]

    await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    // Wave 1: TASK-1, Wave 2: TASK-2
    const tddCalls = vi.mocked(runTddForTasks).mock.calls
    expect(tddCalls).toHaveLength(2)

    // Wave 1 should have TASK-1
    const wave1Tasks = tddCalls[0]![3] as PlannerTask[]
    expect(wave1Tasks).toHaveLength(1)
    expect(wave1Tasks[0]!.id).toBe('TASK-1')

    // Wave 2 should have TASK-2
    const wave2Tasks = tddCalls[1]![3] as PlannerTask[]
    expect(wave2Tasks).toHaveLength(1)
    expect(wave2Tasks[0]!.id).toBe('TASK-2')
  })

  it('accumulates test files across waves', async () => {
    const { runTddForTasks } = await import('../../../src/phases/tdd/tdd-phase.js')
    const { buildCodeAgentPrompt } = await import('../../../src/phases/code/code-agent-prompt.js')

    vi.mocked(runTddForTasks)
      .mockResolvedValueOnce({
        testFiles: ['tests/task1.test.ts'],
        agentReport: { testFiles: ['tests/task1.test.ts'], testResult: { totalTests: 2, passingTests: 0, failingTests: 2, durationMs: 50 }, isRed: true },
      })
      .mockResolvedValueOnce({
        testFiles: ['tests/task2.test.ts'],
        agentReport: { testFiles: ['tests/task2.test.ts'], testResult: { totalTests: 2, passingTests: 0, failingTests: 2, durationMs: 50 }, isRed: true },
      })

    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', { dependencies: ['TASK-1'] }),
    ]

    await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    // Wave 2 code agents should receive both wave 1 and wave 2 test files
    const promptCalls = vi.mocked(buildCodeAgentPrompt).mock.calls
    // Last call is for TASK-2 — should have accumulated test files
    const lastCall = promptCalls[promptCalls.length - 1]!
    const testFilesArg = lastCall[1] as string[]
    expect(testFilesArg).toContain('tests/task1.test.ts')
    expect(testFilesArg).toContain('tests/task2.test.ts')
  })

  it('reviews only the current wave delta instead of the full accumulated diff', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    let parseCallCount = 0
    vi.mocked(parseStructuredOutput).mockImplementation(() => {
      parseCallCount++
      const filesChanged = parseCallCount === 1 ? ['src/task-1.ts'] : ['src/task-2.ts']

      return {
        ok: true,
        output: JSON.stringify({
          filesChanged,
          testResult: { totalTests: 1, passingTests: 1, failingTests: 0, durationMs: 100 },
          buildResult: null,
          summary: 'done',
        }),
        raw: '',
      }
    })
    vi.mocked(getChangedFiles).mockResolvedValue(['src/task-1.ts', 'src/task-2.ts'])

    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', { dependencies: ['TASK-1'] }),
    ]

    await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(vi.mocked(runReviewPhase).mock.calls[0]?.[2]).toEqual(['src/task-1.ts'])
    expect(vi.mocked(runReviewPhase).mock.calls[1]?.[2]).toEqual(['src/task-2.ts'])
  })

  it('records incremental per-wave metadata for downstream consumers', async () => {
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

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

    const result = await executeDag(
      ctx, registry, [createTask('TASK-1')], createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(result.iterations[0]?.metadata).toEqual({
      taskIds: ['TASK-1'],
      pendingTaskIds: ['TASK-1'],
      convergingTaskIds: [],
      reviewedFiles: ['src/a.ts'],
      filesByTask: { 'TASK-1': ['src/a.ts'] },
      tdd: { status: 'succeeded', testFiles: ['tests/feature.test.ts'] },
    })
  })

  it('does not call runTddForTasks for converging (fix) tasks', async () => {
    const { runTddForTasks } = await import('../../../src/phases/tdd/tdd-phase.js')
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    const tasks = [createTask('TASK-1')]

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

    // Wave 1: finding → converge. Wave 2: fix → green.
    vi.mocked(runReviewPhase)
      .mockResolvedValueOnce(createMergedReview({
        criticalCount: 1,
        findings: [{ file: 'src/a.ts', severity: 'critical', category: 'bug', description: 'NPE' }],
      }))
      .mockResolvedValueOnce(createMergedReview())

    await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    // Only 1 TDD call (wave 1 with pending task), not on wave 2 (converging)
    expect(vi.mocked(runTddForTasks)).toHaveBeenCalledTimes(1)
  })

  it('handles agent retry on retryable error codes', async () => {
    const driver = createMockDriver()
    const failResult: AgentResult = {
      success: false,
      errorCode: 'timeout',
      error: 'timed out',
      rawOutput: '',
      stderr: '',
      model: 'opus' as ModelId,
      backend: 'claude' as const,
      durationMs: 100,
    }
    vi.mocked(driver.invoke)
      .mockResolvedValueOnce(failResult)
      .mockResolvedValueOnce(createSuccessResult())
    registry = createMockRegistry(driver)

    const tasks = [createTask('TASK-1')]

    const result = await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(driver.invoke).toHaveBeenCalledTimes(2) // 1 fail + 1 success (code), plus review agents
    expect(result.taskCompletions[0]!.status).toBe('green')
  })

  it('stops with max-iterations when findings never converge', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

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
    vi.mocked(runReviewPhase).mockResolvedValue(createMergedReview({
      criticalCount: 1,
      findings: [{ file: 'src/a.ts', severity: 'critical', category: 'bug', description: 'Still broken' }],
    }))

    const result = await executeDag(
      ctx, registry, [createTask('TASK-1')], createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(result.terminalStatus).toBe('max-iterations')
    expect(result.lastOutcome?.status).toBe('max-iterations')
    expect(result.taskCompletions[0]!.status).toBe('max-iterations')
    expect(result.iterations).toHaveLength(3)
  })

  it('records failed terminal status when agent execution hard-fails', async () => {
    const driver = createMockDriver()
    const failResult: AgentResult = {
      success: false,
      errorCode: 'spawn_error',
      error: 'driver crashed',
      rawOutput: '',
      stderr: '',
      model: 'opus' as ModelId,
      backend: 'claude' as const,
      durationMs: 100,
    }
    vi.mocked(driver.invoke).mockResolvedValue(failResult)
    registry = createMockRegistry(driver)

    const result = await executeDag(
      ctx, registry, [createTask('TASK-1')], createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    expect(result.terminalStatus).toBe('failed')
    expect(result.lastOutcome?.status).toBe('failed')
    expect(result.taskCompletions[0]!.status).toBe('failed')
  })

  it('records timeout terminal status when the phase signal times out', async () => {
    const controller = new AbortController()
    controller.abort(new Error('code-phase-timeout'))

    const result = await executeDag(
      ctx, registry, [createTask('TASK-1')], createTechStack(), 'planner output', controller.signal, createMockLogger(), createGitState()
    )

    expect(result.terminalStatus).toBe('timeout')
    expect(result.lastOutcome?.status).toBe('timeout')
    expect(result.taskCompletions[0]!.status).toBe('timeout')
  })

  it('demotes important findings when convergenceRecommendation is converged', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    const tasks = [createTask('TASK-1')]

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

    // Wave 1: important finding + converged → should go green (important demoted)
    vi.mocked(runReviewPhase).mockResolvedValueOnce({
      ...createMergedReview({
        importantCount: 1,
        findings: [{ file: 'src/a.ts', severity: 'important', category: 'quality', description: 'Style nit' }],
      }),
      convergenceRecommendation: 'converged',
    })

    const result = await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    // Should go green in one iteration since important was demoted
    expect(result.taskCompletions).toHaveLength(1)
    expect(result.taskCompletions[0]!.status).toBe('green')
    expect(result.iterations).toHaveLength(1)
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Merge agent recommends converged')
    )
  })

  it('does not demote critical findings even when converged', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    const tasks = [createTask('TASK-1')]

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

    // Wave 1: critical + converged → critical still blocks
    vi.mocked(runReviewPhase)
      .mockResolvedValueOnce({
        ...createMergedReview({
          criticalCount: 1,
          findings: [{ file: 'src/a.ts', severity: 'critical', category: 'bug', description: 'NPE' }],
        }),
        convergenceRecommendation: 'converged',
      })
      .mockResolvedValueOnce(createMergedReview()) // Wave 2 clean

    const result = await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    // Should NOT go green in one iteration — critical finding still blocks
    expect(result.iterations).toHaveLength(2)
  })

  it('does not demote findings when convergenceRecommendation is continue', async () => {
    const { runReviewPhase } = await import('../../../src/phases/code/review-merge.js')
    const { getChangedFiles } = await import('../../../src/git/git-operations.js')
    const { parseStructuredOutput } = await import('../../../src/drivers/output-parser.js')

    const tasks = [createTask('TASK-1')]

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

    // Wave 1: important finding + continue → still blocks
    vi.mocked(runReviewPhase)
      .mockResolvedValueOnce({
        ...createMergedReview({
          importantCount: 1,
          findings: [{ file: 'src/a.ts', severity: 'important', category: 'quality', description: 'Real issue' }],
        }),
        convergenceRecommendation: 'continue',
      })
      .mockResolvedValueOnce(createMergedReview()) // Wave 2 clean

    const result = await executeDag(
      ctx, registry, tasks, createTechStack(), 'planner output', undefined, createMockLogger(), createGitState()
    )

    // Important finding should still block when continue
    expect(result.iterations).toHaveLength(2)
  })
})

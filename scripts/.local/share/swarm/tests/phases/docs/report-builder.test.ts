import { describe, it, expect, vi } from 'vitest'
import { buildDeliveryReportInput, classifyFindingResolutions } from '../../../src/phases/docs/report-builder.js'
import type {
  PlanPhaseResult,
  TddPhaseResult,
  CodePhaseResult,
  IterationState,
  MergedReview,
  ReviewFinding,
  DeliveryReportInput,
  ReviewFindingSummary,
} from '../../../src/phases/phase-results.js'
import type { SessionContext, SessionId } from '../../../src/core/types.js'
import type { PlannerTask } from '../../../src/phases/plan/task-parser.js'
import type { TestResult } from '../../../src/phases/phase-results.js'
import { createMockEmitter, createSwarmConfig } from '../../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function createPlanResult(overrides: Partial<PlanPhaseResult> = {}): PlanPhaseResult {
  return {
    plannerOutput: '## Tasks\n### TASK-1: Feature\n...',
    tasks: [createTask('TASK-1')],
    techStack: {
      languages: ['typescript'],
      frameworks: ['express'],
      testRunner: 'vitest',
      packageManager: 'pnpm',
      buildTool: 'vite',
      configFiles: ['tsconfig.json'],
      testCommand: 'vitest run',
      buildCommand: null,
    },
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
    },
    ...overrides,
  }
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

function createFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    file: 'src/feature.ts',
    severity: 'critical',
    category: 'bug',
    description: 'Null pointer access on line 42',
    ...overrides,
  }
}

function createCodeResult(overrides: Partial<CodePhaseResult> = {}): CodePhaseResult {
  return {
    waves: [
      {
        waveIndex: 0,
        tasks: [createTask('TASK-1')],
      },
    ],
    iterations: [
      {
        iteration: 1,
        outcome: {
          status: 'green',
          testResult: createTestResult(),
          review: createMergedReview(),
        },
        changedFiles: ['src/feature.ts'],
      },
    ],
    finalTestResult: createTestResult(),
    finalReview: createMergedReview(),
    gitState: {
      branch: 'feat/test-session',
      prNumber: 42,
      prUrl: 'https://github.com/org/repo/pull/42',
      commits: [
        { hash: 'abc1234', message: 'feat: implement feature', specItem: 'TASK-1', iteration: 1 },
      ],
    },
    changedFiles: ['src/feature.ts'],
    success: true,
    terminalStatus: 'green',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildDeliveryReportInput
// ---------------------------------------------------------------------------

describe('buildDeliveryReportInput', () => {
  it('transforms plan + tdd + code results into DeliveryReportInput', () => {
    const ctx = createSessionContext()
    const plan = createPlanResult()
    const tdd = createTddResult()
    const code = createCodeResult()

    const result = buildDeliveryReportInput(ctx, plan, tdd, code)

    expect(result).toMatchObject({
      sessionId: 'test-session',
      specPath: '/tmp/project/spec.md',
    })
    expect(result.specItems).toHaveLength(1)
    expect(result.startedAt).toBeDefined()
    expect(result.completedAt).toBeDefined()
    expect(result.totalDuration).toBeGreaterThanOrEqual(0)
  })

  it('handles null tddResult gracefully', () => {
    const ctx = createSessionContext()
    const plan = createPlanResult()
    const code = createCodeResult()

    const result = buildDeliveryReportInput(ctx, plan, null, code)

    expect(result.sessionId).toBe('test-session')
    expect(result.specItems).toHaveLength(1)
  })

  it('includes session duration calculation', () => {
    const startedAt = new Date(Date.now() - 60_000).toISOString()
    const state = {
      load: vi.fn(),
      save: vi.fn(),
      acquireLock: vi.fn(),
      releaseLock: vi.fn(),
    }
    const ctx = createSessionContext({ state })

    const plan = createPlanResult()
    const code = createCodeResult()

    const result = buildDeliveryReportInput(ctx, plan, null, code)

    expect(result.totalDuration).toBeTypeOf('number')
    expect(result.totalDuration).toBeGreaterThanOrEqual(0)
  })

  it('maps tasks with correct ids and tags', () => {
    const task1 = createTask('TASK-1', { tag: 'frontend', title: 'Build UI' })
    const task2 = createTask('TASK-2', { tag: 'backend', title: 'Build API' })
    const plan = createPlanResult({
      tasks: [task1, task2],
      taskCount: 2,
    })
    const code = createCodeResult({
      waves: [{ waveIndex: 0, tasks: [task1, task2] }],
      iterations: [
        {
          iteration: 1,
          outcome: { status: 'green', testResult: createTestResult(), review: createMergedReview() },
          changedFiles: ['src/ui.ts', 'src/api.ts'],
        },
      ],
    })

    const result = buildDeliveryReportInput(createSessionContext(), plan, null, code)

    const allTasks = result.specItems.flatMap(si => si.tasks)
    const taskIds = allTasks.map(t => t.id)
    expect(taskIds).toContain('TASK-1')
    expect(taskIds).toContain('TASK-2')
    const t1 = allTasks.find(t => t.id === 'TASK-1')
    expect(t1?.tag).toBe('frontend')
  })

  it('includes review findings from iterations', () => {
    const finding = createFinding({ severity: 'critical', category: 'security' })
    const code = createCodeResult({
      iterations: [
        {
          iteration: 1,
          outcome: {
            status: 'needs-iteration',
            testResult: createTestResult(),
            review: createMergedReview({
              findings: [finding],
              criticalCount: 1,
            }),
            reason: 'review-findings',
          },
          changedFiles: ['src/feature.ts'],
        },
        {
          iteration: 2,
          outcome: {
            status: 'green',
            testResult: createTestResult(),
            review: createMergedReview(),
          },
          changedFiles: ['src/feature.ts'],
        },
      ],
    })

    const result = buildDeliveryReportInput(createSessionContext(), createPlanResult(), null, code)

    const allFindings = result.specItems.flatMap(si => si.reviewFindings)
    expect(allFindings.length).toBeGreaterThan(0)
    expect(allFindings.some(f => f.severity === 'critical')).toBe(true)
  })

  it('keeps last reviewed findings visible for max-iterations outcomes', () => {
    const finding = createFinding({ description: 'Still failing after retries' })
    const code = createCodeResult({
      success: false,
      terminalStatus: 'max-iterations',
      iterations: [
        {
          iteration: 1,
          outcome: {
            status: 'max-iterations',
            testResult: createTestResult({ passingTests: 8, failingTests: 2 }),
            review: createMergedReview({ findings: [finding], criticalCount: 1 }),
          },
          changedFiles: ['src/feature.ts'],
        },
      ],
    })

    const result = buildDeliveryReportInput(createSessionContext(), createPlanResult(), null, code)

    expect(result.specItems[0]!.success).toBe(false)
    expect(result.specItems[0]!.reviewFindings[0]!.description).toContain('Still failing after retries')
  })
})

// ---------------------------------------------------------------------------
// classifyFindingResolutions
// ---------------------------------------------------------------------------

describe('classifyFindingResolutions', () => {
  it('marks a finding as resolved if it appeared in iteration N but not N+1', () => {
    const finding = createFinding({
      file: 'src/a.ts',
      category: 'bug',
      description: 'Null pointer',
    })
    const iterations: IterationState[] = [
      {
        iteration: 1,
        outcome: {
          status: 'needs-iteration',
          testResult: createTestResult(),
          review: createMergedReview({ findings: [finding], criticalCount: 1 }),
          reason: 'review-findings',
        },
        changedFiles: ['src/a.ts'],
      },
      {
        iteration: 2,
        outcome: {
          status: 'green',
          testResult: createTestResult(),
          review: createMergedReview(),
        },
        changedFiles: ['src/a.ts'],
      },
    ]

    const result = classifyFindingResolutions(iterations)

    const resolved = result.filter(r => r.resolved)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.description).toContain('Null pointer')
  })

  it('marks a finding as unresolved if it appeared in both iterations', () => {
    const finding = createFinding({
      file: 'src/a.ts',
      category: 'bug',
      description: 'Null pointer',
    })
    const iterations: IterationState[] = [
      {
        iteration: 1,
        outcome: {
          status: 'needs-iteration',
          testResult: createTestResult(),
          review: createMergedReview({ findings: [finding], criticalCount: 1 }),
          reason: 'review-findings',
        },
        changedFiles: ['src/a.ts'],
      },
      {
        iteration: 2,
        outcome: {
          status: 'needs-iteration',
          testResult: createTestResult(),
          review: createMergedReview({ findings: [finding], criticalCount: 1 }),
          reason: 'review-findings',
        },
        changedFiles: ['src/a.ts'],
      },
    ]

    const result = classifyFindingResolutions(iterations)

    const unresolved = result.filter(r => !r.resolved)
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0]!.description).toContain('Null pointer')
  })

  it('handles empty iterations array', () => {
    const result = classifyFindingResolutions([])

    expect(result).toEqual([])
  })

  it('skips iterations without review (timeout/max-iterations)', () => {
    const finding = createFinding({
      file: 'src/a.ts',
      category: 'bug',
      description: 'Null pointer',
    })
    const iterations: IterationState[] = [
      {
        iteration: 1,
        outcome: {
          status: 'needs-iteration',
          testResult: createTestResult(),
          review: createMergedReview({ findings: [finding], criticalCount: 1 }),
          reason: 'review-findings',
        },
        changedFiles: ['src/a.ts'],
      },
      {
        iteration: 2,
        outcome: {
          status: 'timeout',
          // no review
        },
        changedFiles: [],
      },
    ]

    const result = classifyFindingResolutions(iterations)

    // Finding from iteration 1 remains unresolved because iteration 2 has no review
    const unresolved = result.filter(r => !r.resolved)
    expect(unresolved.length).toBeGreaterThan(0)
  })

  it('matches by file + category + whitespace-normalized description', () => {
    const findingV1 = createFinding({
      file: 'src/a.ts',
      category: 'bug',
      description: 'Null  pointer  access',
    })
    const findingV2 = createFinding({
      file: 'src/a.ts',
      category: 'bug',
      description: 'Null pointer access',
    })
    const iterations: IterationState[] = [
      {
        iteration: 1,
        outcome: {
          status: 'needs-iteration',
          testResult: createTestResult(),
          review: createMergedReview({ findings: [findingV1], criticalCount: 1 }),
          reason: 'review-findings',
        },
        changedFiles: ['src/a.ts'],
      },
      {
        iteration: 2,
        outcome: {
          status: 'needs-iteration',
          testResult: createTestResult(),
          review: createMergedReview({ findings: [findingV2], criticalCount: 1 }),
          reason: 'review-findings',
        },
        changedFiles: ['src/a.ts'],
      },
    ]

    const result = classifyFindingResolutions(iterations)

    // Same finding (whitespace-normalized) in both iterations = unresolved
    const unresolved = result.filter(r => !r.resolved)
    expect(unresolved).toHaveLength(1)
  })
})

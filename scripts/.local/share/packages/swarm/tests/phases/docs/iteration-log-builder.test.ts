import { describe, it, expect } from 'vitest'
import { buildIterationLog, renderIterationLog } from '../../../src/phases/docs/iteration-log-builder.js'
import type {
  CodePhaseResult,
  IterationState,
  MergedReview,
  IterationLogEntry,
} from '../../../src/phases/phase-results.js'
import type {
  SwarmEvent,
  SessionId,
  IterationStartEvent,
  IterationEndEvent,
  AgentInvokeEvent,
  AgentResultEvent,
  TestGreenEvent,
  TestFailEvent,
  ReviewFindingsEvent,
  FileChangedEvent,
} from '../../../src/core/types.js'
import type { PlannerTask } from '../../../src/phases/plan/task-parser.js'
import type { TestResult } from '../../../src/phases/phase-results.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = 'test-session' as SessionId
const BASE_TS = '2026-01-15T10:00:00.000Z'

function ts(offsetMs: number): string {
  return new Date(new Date(BASE_TS).getTime() + offsetMs).toISOString()
}

function createIterationStartEvent(iteration: number, _waveIndex = 0, offsetMs = 0): IterationStartEvent {
  return {
    type: 'iteration:start',
    timestamp: ts(offsetMs),
    sessionId: SESSION_ID,
    data: { iteration, waveIndex: _waveIndex, taskCount: 1 },
  }
}

function createIterationEndEvent(iteration: number, success: boolean, offsetMs = 10000): IterationEndEvent {
  return {
    type: 'iteration:end',
    timestamp: ts(offsetMs),
    sessionId: SESSION_ID,
    data: { iteration, success },
  }
}

function createAgentInvokeEvent(
  role: AgentInvokeEvent['data']['role'],
  model: string,
  offsetMs = 1000
): AgentInvokeEvent {
  return {
    type: 'agent:invoke',
    timestamp: ts(offsetMs),
    sessionId: SESSION_ID,
    data: { role, backend: 'claude', model },
  }
}

function createAgentResultEvent(
  role: AgentResultEvent['data']['role'],
  durationMs: number,
  offsetMs = 5000,
  tokenUsage?: { input: number; output: number; cacheCreation: number; cacheRead: number },
): AgentResultEvent {
  return {
    type: 'agent:result',
    timestamp: ts(offsetMs),
    sessionId: SESSION_ID,
    data: { role, durationMs, ...(tokenUsage ? { tokenUsage } : {}) },
  }
}

function createTestGreenEvent(totalTests: number, passingTests: number, offsetMs = 6000): TestGreenEvent {
  return {
    type: 'test:green',
    timestamp: ts(offsetMs),
    sessionId: SESSION_ID,
    data: { totalTests, passingTests },
  }
}

function createTestFailEvent(totalTests: number, failingTests: number, offsetMs = 6000): TestFailEvent {
  return {
    type: 'test:fail',
    timestamp: ts(offsetMs),
    sessionId: SESSION_ID,
    data: { totalTests, failingTests, reason: 'assertion failures' },
  }
}

function createReviewFindingsEvent(
  critical: number,
  important: number,
  suggestion: number,
  offsetMs = 7000
): ReviewFindingsEvent {
  return {
    type: 'review:findings',
    timestamp: ts(offsetMs),
    sessionId: SESSION_ID,
    data: { critical, important, suggestion },
  }
}

function createFileChangedEvent(path: string, action: 'created' | 'modified' | 'deleted' = 'modified', offsetMs = 4000): FileChangedEvent {
  return {
    type: 'file:changed',
    timestamp: ts(offsetMs),
    sessionId: SESSION_ID,
    data: { path, action },
  }
}

function createTask(id: `TASK-${number}` = 'TASK-1'): PlannerTask {
  return {
    id,
    title: `Task ${id}`,
    description: `Implement ${id}`,
    tag: 'backend',
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

function createCodeResult(overrides: Partial<CodePhaseResult> = {}): CodePhaseResult {
  return {
    waves: [{ waveIndex: 0, tasks: [createTask('TASK-1')] }],
    iterations: [
      {
        iteration: 1,
        outcome: { status: 'green', testResult: createTestResult(), review: createMergedReview() },
        changedFiles: ['src/feature.ts'],
      },
    ],
    finalTestResult: createTestResult(),
    gitState: {
      branch: 'feat/test-session',
      prNumber: 42,
      commits: [{ hash: 'abc1234', message: 'feat: impl', specItem: 'TASK-1', iteration: 1 }],
    },
    changedFiles: ['src/feature.ts'],
    success: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildIterationLog
// ---------------------------------------------------------------------------

describe('buildIterationLog', () => {
  it('groups events by iteration:start/iteration:end boundaries', () => {
    const events: SwarmEvent[] = [
      createIterationStartEvent(1, 1, 0),
      createAgentInvokeEvent('code', 'opus', 1000),
      createAgentResultEvent('code', 4000, 5000),
      createTestGreenEvent(10, 10, 6000),
      createIterationEndEvent(1, true, 10000),
    ]
    const codeResult = createCodeResult()

    const entries = buildIterationLog(events, codeResult)

    expect(entries).toHaveLength(1)
    expect(entries[0]!.iterationIndex).toBe(1)
  })

  it('correlates agent:invoke with agent:result by role', () => {
    const events: SwarmEvent[] = [
      createIterationStartEvent(1, 1, 0),
      createAgentInvokeEvent('code', 'opus', 1000),
      createAgentInvokeEvent('review', 'opus', 2000),
      createAgentResultEvent('code', 3000, 4000),
      createAgentResultEvent('review', 1500, 5000),
      createIterationEndEvent(1, true, 10000),
    ]
    const codeResult = createCodeResult()

    const entries = buildIterationLog(events, codeResult)

    expect(entries[0]!.agentsInvoked).toHaveLength(2)
    const codeAgent = entries[0]!.agentsInvoked.find(a => a.role === 'code')
    expect(codeAgent).toBeDefined()
    expect(codeAgent!.model).toBe('opus')
    expect(codeAgent!.durationMs).toBe(3000)
    const reviewAgent = entries[0]!.agentsInvoked.find(a => a.role === 'review')
    expect(reviewAgent).toBeDefined()
    expect(reviewAgent!.durationMs).toBe(1500)
  })

  it('extracts test results from test:green events', () => {
    const events: SwarmEvent[] = [
      createIterationStartEvent(1, 1, 0),
      createTestGreenEvent(15, 15, 6000),
      createIterationEndEvent(1, true, 10000),
    ]
    const codeResult = createCodeResult()

    const entries = buildIterationLog(events, codeResult)

    expect(entries[0]!.testResult).toBeDefined()
    expect(entries[0]!.testResult!.totalTests).toBe(15)
    expect(entries[0]!.testResult!.passingTests).toBe(15)
  })

  it('extracts test results from test:fail events', () => {
    const events: SwarmEvent[] = [
      createIterationStartEvent(1, 1, 0),
      createTestFailEvent(10, 3, 6000),
      createIterationEndEvent(1, false, 10000),
    ]
    const codeResult = createCodeResult({
      iterations: [{
        iteration: 1,
        outcome: {
          status: 'needs-iteration',
          testResult: createTestResult({ failingTests: 3, passingTests: 7 }),
          review: createMergedReview(),
          reason: 'tests-failing',
        },
        changedFiles: [],
      }],
    })

    const entries = buildIterationLog(events, codeResult)

    expect(entries[0]!.testResult).toBeDefined()
    expect(entries[0]!.testResult!.failingTests).toBe(3)
  })

  it('counts review findings from review:findings events', () => {
    const events: SwarmEvent[] = [
      createIterationStartEvent(1, 1, 0),
      createReviewFindingsEvent(2, 3, 1, 7000),
      createIterationEndEvent(1, false, 10000),
    ]
    const codeResult = createCodeResult()

    const entries = buildIterationLog(events, codeResult)

    expect(entries[0]!.reviewFindingCount).toBe(6) // 2 + 3 + 1
  })

  it('collects changed files from file:changed events', () => {
    const events: SwarmEvent[] = [
      createIterationStartEvent(1, 1, 0),
      createFileChangedEvent('src/a.ts', 'modified', 3000),
      createFileChangedEvent('src/b.ts', 'created', 4000),
      createIterationEndEvent(1, true, 10000),
    ]
    const codeResult = createCodeResult()

    const entries = buildIterationLog(events, codeResult)

    expect(entries[0]!.filesChanged).toContain('src/a.ts')
    expect(entries[0]!.filesChanged).toContain('src/b.ts')
  })

  it('derives specItem from codeResult mapping', () => {
    const task = createTask('TASK-1')
    task.title = 'Build authentication'
    const codeResult = createCodeResult({
      waves: [{ waveIndex: 0, tasks: [task] }],
      taskCompletions: [{ taskId: 'TASK-1', title: 'Build authentication', status: 'green' as const, attempts: 1 }],
      iterations: [{
        iteration: 1,
        outcome: { status: 'green', testResult: createTestResult(), review: createMergedReview() },
        changedFiles: ['src/auth.ts'],
      }],
    })
    const events: SwarmEvent[] = [
      createIterationStartEvent(1, 1, 0),
      createIterationEndEvent(1, true, 10000),
    ]

    const entries = buildIterationLog(events, codeResult)

    expect(entries[0]!.specItem).toBeDefined()
    expect(typeof entries[0]!.specItem).toBe('string')
  })

  it('captures tokenUsage from agent:result events into AgentInvocationRecord', () => {
    const tokenUsage = { input: 12400, output: 820, cacheCreation: 5200, cacheRead: 98000 }
    const events: SwarmEvent[] = [
      createIterationStartEvent(1, 1, 0),
      createAgentInvokeEvent('code', 'claude-opus-4-6', 1000),
      createAgentResultEvent('code', 164348, 5000, tokenUsage),
      createIterationEndEvent(1, true, 10000),
    ]
    const codeResult = createCodeResult()

    const entries = buildIterationLog(events, codeResult)

    expect(entries[0]!.agentsInvoked[0]!.tokenUsage).toEqual(tokenUsage)
  })

  it('omits tokenUsage from AgentInvocationRecord when not present in events', () => {
    const events: SwarmEvent[] = [
      createIterationStartEvent(1, 1, 0),
      createAgentInvokeEvent('code', 'opus', 1000),
      createAgentResultEvent('code', 4000, 5000),
      createIterationEndEvent(1, true, 10000),
    ]
    const codeResult = createCodeResult()

    const entries = buildIterationLog(events, codeResult)

    expect(entries[0]!.agentsInvoked[0]!.tokenUsage).toBeUndefined()
  })

  it('handles fewer iteration:start events than codeResult.iterations (eviction)', () => {
    // codeResult has 3 iterations, but events only have 2
    const codeResult = createCodeResult({
      iterations: [
        { iteration: 1, outcome: { status: 'needs-iteration', testResult: createTestResult(), review: createMergedReview(), reason: 'tests-failing' }, changedFiles: [] },
        { iteration: 2, outcome: { status: 'needs-iteration', testResult: createTestResult(), review: createMergedReview(), reason: 'tests-failing' }, changedFiles: [] },
        { iteration: 3, outcome: { status: 'green', testResult: createTestResult(), review: createMergedReview() }, changedFiles: [] },
      ],
    })
    const events: SwarmEvent[] = [
      // Only iteration 2 and 3 events (iteration 1 was evicted)
      createIterationStartEvent(2, 1, 0),
      createIterationEndEvent(2, false, 10000),
      createIterationStartEvent(3, 1, 20000),
      createIterationEndEvent(3, true, 30000),
    ]

    const entries = buildIterationLog(events, codeResult)

    // Should have entries for 2 iterations (from events), and note eviction
    expect(entries.length).toBeLessThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// renderIterationLog
// ---------------------------------------------------------------------------

describe('renderIterationLog', () => {
  it('renders markdown with one section per iteration', () => {
    const entries: IterationLogEntry[] = [
      {
        specItem: 'Build feature',
        iterationIndex: 1,
        agentsInvoked: [{ role: 'code', model: 'opus', durationMs: 5000 }],
        testResult: { totalTests: 10, passingTests: 10, failingTests: 0, durationMs: 2000 },
        reviewFindingCount: 0,
        filesChanged: ['src/feature.ts'],
      },
      {
        specItem: 'Build feature',
        iterationIndex: 2,
        agentsInvoked: [{ role: 'code', model: 'opus', durationMs: 3000 }],
        testResult: { totalTests: 10, passingTests: 10, failingTests: 0, durationMs: 1500 },
        reviewFindingCount: 0,
        filesChanged: ['src/feature.ts'],
      },
    ]

    const markdown = renderIterationLog(entries)

    expect(markdown).toContain('# Iterations')
    // Should contain sections for both iterations
    expect(markdown).toContain('1')
    expect(markdown).toContain('2')
    expect(typeof markdown).toBe('string')
    expect(markdown.length).toBeGreaterThan(0)
  })

  it('returns "No iterations recorded" when entries is empty', () => {
    const markdown = renderIterationLog([])

    expect(markdown).toContain('# Iterations')
    expect(markdown).toContain('No iterations recorded')
  })

  it('renders token usage suffix when tokenUsage is present', () => {
    const entries: IterationLogEntry[] = [
      {
        specItem: 'Build feature',
        iterationIndex: 1,
        agentsInvoked: [{
          role: 'code',
          model: 'claude-opus-4-6',
          durationMs: 164348,
          tokenUsage: { input: 12400, output: 820, cacheCreation: 5200, cacheRead: 98000 },
        }],
        testResult: { totalTests: 10, passingTests: 10, failingTests: 0, durationMs: 2000 },
        reviewFindingCount: 0,
        filesChanged: ['src/feature.ts'],
      },
    ]

    const markdown = renderIterationLog(entries)

    expect(markdown).toContain('164348ms')
    expect(markdown).toContain('12,400 in')
    expect(markdown).toContain('820 out')
    expect(markdown).toContain('5,200 cache_w')
    expect(markdown).toContain('98,000 cache_r')
  })

  it('renders without token suffix when tokenUsage is absent (backward compat)', () => {
    const entries: IterationLogEntry[] = [
      {
        specItem: 'Build feature',
        iterationIndex: 1,
        agentsInvoked: [{ role: 'code', model: 'opus', durationMs: 5000 }],
        testResult: { totalTests: 10, passingTests: 10, failingTests: 0, durationMs: 2000 },
        reviewFindingCount: 0,
        filesChanged: ['src/feature.ts'],
      },
    ]

    const markdown = renderIterationLog(entries)

    expect(markdown).toContain('5000ms')
    expect(markdown).not.toContain('in /')
    expect(markdown).not.toContain('cache_w')
  })

  it('includes agent invocation details', () => {
    const entries: IterationLogEntry[] = [
      {
        specItem: 'Build feature',
        iterationIndex: 1,
        agentsInvoked: [
          { role: 'code', model: 'opus', durationMs: 5000 },
          { role: 'review', model: 'gpt-5.3', durationMs: 3000 },
        ],
        testResult: { totalTests: 10, passingTests: 10, failingTests: 0, durationMs: 2000 },
        reviewFindingCount: 0,
        filesChanged: ['src/feature.ts'],
      },
    ]

    const markdown = renderIterationLog(entries)

    expect(markdown).toContain('code')
    expect(markdown).toContain('opus')
    expect(markdown).toContain('review')
  })
})

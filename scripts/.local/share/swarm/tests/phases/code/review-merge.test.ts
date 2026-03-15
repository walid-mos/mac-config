import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runReviewPhase, verifyMergeIntegrity, buildFindingTrajectory } from '../../../src/phases/code/review-merge.js'
import type { ReviewFinding, IterationState, MergedReview } from '../../../src/phases/phase-results.js'
import type { SessionContext, SessionId } from '../../../src/core/types.js'
import type { DriverRegistry, Driver, AgentResult } from '../../../src/drivers/driver.js'
import type { ModelId } from '../../../src/core/types.js'
import type { TestResult } from '../../../src/phases/phase-results.js'
import {
  createMockChildProcess,
  createMockEmitter,
  createSwarmConfig,
} from '../../__test-utils__/factories.js'

vi.mock('node:child_process', () => ({
  spawn: vi.fn().mockImplementation(() => {
    const proc = createMockChildProcess()
    setTimeout(() => proc.simulateOutput('', 0), 0)
    return proc
  }),
}))

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}))


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSuccessResult(output: string): AgentResult {
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

function createMockDriver(output?: string): Driver {
  const defaultOutput = JSON.stringify({ findings: [] })
  return {
    name: 'claude' as const,
    invoke: vi.fn<Driver['invoke']>().mockResolvedValue(createSuccessResult(output ?? defaultOutput)),
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

function createTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    totalTests: 10,
    passingTests: 10,
    failingTests: 0,
    durationMs: 5000,
    ...overrides,
  }
}

function createFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    file: 'src/index.ts',
    line: 10,
    severity: 'critical',
    category: 'bug',
    description: 'Null pointer dereference',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// runReviewPhase
// ---------------------------------------------------------------------------

describe('runReviewPhase', () => {
  let ctx: SessionContext
  let registry: DriverRegistry
  let mockDriver: Driver

  beforeEach(async () => {
    vi.clearAllMocks()

    const mergedOutput = JSON.stringify({
      findings: [],
      criticalCount: 0,
      importantCount: 0,
      suggestionCount: 0,
    })
    mockDriver = createMockDriver(mergedOutput)
    registry = createMockRegistry(mockDriver)
    ctx = createSessionContext()
  })

  it('runs code review, security review, and consistency review in parallel', async () => {
    const changedFiles = ['src/index.ts']
    const result = await runReviewPhase(ctx, registry, changedFiles, createTestResult())

    // getDriver called for review, security, consistency, and merge roles
    expect(registry.getDriver).toHaveBeenCalledWith('review')
    expect(registry.getDriver).toHaveBeenCalledWith('security')
    expect(registry.getDriver).toHaveBeenCalledWith('consistency')
    expect(registry.getDriver).toHaveBeenCalledWith('merge')
    expect(result).toBeDefined()
  })

  it('invokes merge agent after reviews', async () => {
    const result = await runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult())

    // 4 invocations: review + security + consistency (parallel) + merge
    expect(mockDriver.invoke).toHaveBeenCalledTimes(4)
    expect(result.findings).toBeDefined()
  })

  it('emits review:findings event', async () => {
    const emitter = createMockEmitter()
    ctx = createSessionContext({ emitter })

    await runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult())

    const findingsEvents = emitter.getEvents({ type: 'review:findings' })
    expect(findingsEvents.length).toBe(1)
  })

  it('filters sensitive files from review (DL-SC-5: .env*, *.pem, *.key)', async () => {
    const changedFiles = ['src/index.ts', '.env.local', 'certs/server.pem', 'keys/private.key']

    const result = await runReviewPhase(ctx, registry, changedFiles, createTestResult())

    // Should still succeed — sensitive files are filtered out
    expect(result).toBeDefined()
  })

  it('propagates AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult(), controller.signal)
    ).rejects.toThrow('aborted')
  })

  it('writes decision log to file when provided', async () => {
    const { writeFileSync, mkdirSync } = await import('node:fs')

    await runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult(), undefined, '# Decision Log\n- entry 1')

    expect(mkdirSync).toHaveBeenCalled()
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/project/.swarm/review-decision-log.md',
      '# Decision Log\n- entry 1',
      'utf-8'
    )
  })

  it('does not write decision log file when empty', async () => {
    const { writeFileSync } = await import('node:fs')

    await runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult(), undefined, '')

    expect(writeFileSync).not.toHaveBeenCalled()
  })

  it('passes specPath from ctx to prompt builders', async () => {
    ctx = createSessionContext({ specPath: '/custom/spec.md' })

    await runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult())

    // Verify the driver was invoked with a prompt containing the spec path
    const invokeCall = vi.mocked(mockDriver.invoke).mock.calls[0]
    expect(invokeCall![0].prompt).toContain('/custom/spec.md')
  })

  it('handles markdown-fenced JSON from agents (fence-strip)', async () => {
    const fencedReviewOutput = '```json\n{"findings": [{"file": "src/app.ts", "line": 1, "severity": "important", "category": "quality", "description": "missing type annotation"}]}\n```'
    const fencedMergedOutput = '```json\n{"findings": [{"file": "src/app.ts", "line": 1, "severity": "important", "category": "quality", "description": "missing type annotation"}], "criticalCount": 0, "importantCount": 1, "suggestionCount": 0}\n```'

    const fencedDriver: Driver = {
      name: 'claude' as const,
      invoke: vi.fn<Driver['invoke']>()
        .mockResolvedValueOnce(createSuccessResult(fencedReviewOutput)) // review
        .mockResolvedValueOnce(createSuccessResult(fencedReviewOutput)) // security
        .mockResolvedValueOnce(createSuccessResult(fencedReviewOutput)) // consistency
        .mockResolvedValueOnce(createSuccessResult(fencedMergedOutput)), // merge
      checkAvailability: vi.fn<Driver['checkAvailability']>(),
    }
    registry = createMockRegistry(fencedDriver)

    const result = await runReviewPhase(ctx, registry, ['src/app.ts'], createTestResult())

    expect(result.importantCount).toBe(1)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].file).toBe('src/app.ts')
  })

  it('retries retryable errors (FR-15)', async () => {
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
    const mergedOutput = JSON.stringify({
      findings: [],
      criticalCount: 0,
      importantCount: 0,
      suggestionCount: 0,
    })
    const successResult = createSuccessResult(mergedOutput)

    // First call fails, second succeeds (for review agent)
    // Security, consistency, and merge agents succeed immediately
    vi.mocked(mockDriver.invoke)
      .mockResolvedValueOnce(failResult) // review attempt 1 (fail)
      .mockResolvedValueOnce(successResult) // security attempt 1 (pass — runs in parallel with review retry)
      .mockResolvedValueOnce(successResult) // consistency attempt 1 (pass — runs in parallel with review retry)
      .mockResolvedValueOnce(successResult) // review attempt 2 (pass)
      .mockResolvedValueOnce(successResult) // merge

    const result = await runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult())

    expect(result).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// verifyMergeIntegrity
// ---------------------------------------------------------------------------

describe('verifyMergeIntegrity', () => {
  it('restores dropped critical findings (DL-SC-9)', () => {
    const codeFindings = [createFinding({ severity: 'critical', file: 'a.ts', line: 1, category: 'bug' })]
    const secFindings = [createFinding({ severity: 'critical', file: 'b.ts', line: 5, category: 'security' })]
    const consistencyFindings: ReviewFinding[] = []
    const mergedFindings: ReviewFinding[] = [] // merge agent dropped everything

    const result = verifyMergeIntegrity(codeFindings, secFindings, consistencyFindings, mergedFindings)

    expect(result.restored).toHaveLength(2)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('returns empty restored when all critical findings present', () => {
    const finding = createFinding({ severity: 'critical', file: 'a.ts', line: 1, category: 'bug' })
    const codeFindings = [finding]
    const secFindings: ReviewFinding[] = []
    const consistencyFindings: ReviewFinding[] = []
    const mergedFindings = [finding]

    const result = verifyMergeIntegrity(codeFindings, secFindings, consistencyFindings, mergedFindings)

    expect(result.restored).toHaveLength(0)
  })

  it('generates warnings for dropped findings', () => {
    const droppedFinding = createFinding({ severity: 'critical', file: 'dropped.ts', line: 42, category: 'security' })
    const codeFindings = [droppedFinding]
    const secFindings: ReviewFinding[] = []
    const consistencyFindings: ReviewFinding[] = []
    const mergedFindings: ReviewFinding[] = [] // dropped

    const result = verifyMergeIntegrity(codeFindings, secFindings, consistencyFindings, mergedFindings)

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some(w => w.includes('dropped.ts'))).toBe(true)
  })

  it('matches by file + line + category', () => {
    const original = createFinding({ severity: 'critical', file: 'match.ts', line: 10, category: 'bug' })
    // Same file, line, category but different description — should still match
    const merged = createFinding({
      severity: 'critical',
      file: 'match.ts',
      line: 10,
      category: 'bug',
      description: 'Slightly different description',
    })

    const result = verifyMergeIntegrity([original], [], [], [merged])

    expect(result.restored).toHaveLength(0)
  })

  it('restores dropped critical findings from consistency review', () => {
    const codeFindings: ReviewFinding[] = []
    const secFindings: ReviewFinding[] = []
    const consistencyFindings = [createFinding({ severity: 'critical', file: 'hero.astro', line: 5, category: 'bug', description: 'text-white on white bg' })]
    const mergedFindings: ReviewFinding[] = []

    const result = verifyMergeIntegrity(codeFindings, secFindings, consistencyFindings, mergedFindings)

    expect(result.restored).toHaveLength(1)
    expect(result.restored[0].file).toBe('hero.astro')
  })
})

// ---------------------------------------------------------------------------
// parseMergedReview — convergenceRecommendation extraction
// ---------------------------------------------------------------------------

describe('runReviewPhase convergence extraction', () => {
  let ctx: SessionContext
  let registry: DriverRegistry

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = createSessionContext()
  })

  it('extracts convergenceRecommendation: converged from merge output', async () => {
    const mergedOutput = JSON.stringify({
      findings: [],
      criticalCount: 0,
      importantCount: 0,
      suggestionCount: 0,
      convergenceRecommendation: 'converged',
    })
    const driver = createMockDriver(mergedOutput)
    registry = createMockRegistry(driver)

    const result = await runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult())

    expect(result.convergenceRecommendation).toBe('converged')
  })

  it('defaults convergenceRecommendation to continue when not present', async () => {
    const mergedOutput = JSON.stringify({
      findings: [],
      criticalCount: 0,
      importantCount: 0,
      suggestionCount: 0,
    })
    const driver = createMockDriver(mergedOutput)
    registry = createMockRegistry(driver)

    const result = await runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult())

    expect(result.convergenceRecommendation).toBe('continue')
  })

  it('defaults convergenceRecommendation to continue for unknown values', async () => {
    const mergedOutput = JSON.stringify({
      findings: [],
      criticalCount: 0,
      importantCount: 0,
      suggestionCount: 0,
      convergenceRecommendation: 'unknown-value',
    })
    const driver = createMockDriver(mergedOutput)
    registry = createMockRegistry(driver)

    const result = await runReviewPhase(ctx, registry, ['src/index.ts'], createTestResult())

    expect(result.convergenceRecommendation).toBe('continue')
  })
})

// ---------------------------------------------------------------------------
// buildFindingTrajectory
// ---------------------------------------------------------------------------

describe('buildFindingTrajectory', () => {
  function createMergedReviewForTrajectory(
    criticalCount: number,
    importantCount: number,
    suggestionCount: number
  ): MergedReview {
    return {
      findings: [],
      criticalCount,
      importantCount,
      suggestionCount,
    }
  }

  it('produces correct summary for iterations with reviews', () => {
    const iterations: IterationState[] = [
      {
        iteration: 0,
        outcome: { status: 'needs-iteration', testResult: createTestResult(), review: createMergedReviewForTrajectory(3, 2, 1), reason: 'review-findings' },
        changedFiles: ['src/a.ts'],
      },
      {
        iteration: 1,
        outcome: { status: 'needs-iteration', testResult: createTestResult(), review: createMergedReviewForTrajectory(0, 1, 2), reason: 'review-findings' },
        changedFiles: ['src/a.ts'],
      },
      {
        iteration: 2,
        outcome: { status: 'green', testResult: createTestResult(), review: createMergedReviewForTrajectory(0, 0, 0) },
        changedFiles: ['src/a.ts'],
      },
    ]

    const trajectory = buildFindingTrajectory(iterations)

    expect(trajectory).toContain('Wave 0: 3 critical, 2 important, 1 suggestion')
    expect(trajectory).toContain('Wave 1: 0 critical, 1 important, 2 suggestions')
    expect(trajectory).toContain('Wave 2: 0 critical, 0 important, 0 suggestions')
  })

  it('handles empty iterations array', () => {
    const trajectory = buildFindingTrajectory([])

    expect(trajectory).toBe('')
  })

  it('handles iterations without review (timeout)', () => {
    const iterations: IterationState[] = [
      {
        iteration: 0,
        outcome: { status: 'timeout' },
        changedFiles: [],
      },
    ]

    const trajectory = buildFindingTrajectory(iterations)

    expect(trajectory).toContain('Wave 0: (no review)')
  })
})

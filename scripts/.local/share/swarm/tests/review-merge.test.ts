import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runReviewPhase, verifyMergeIntegrity } from '../src/review-merge.js'
import type { ReviewFinding, MergedReview } from '../src/phase-results.js'
import type { SessionContext, SessionId } from '../src/types.js'
import type { DriverRegistry, Driver, AgentResult } from '../src/drivers/driver.js'
import type { ModelId } from '../src/types.js'
import type { TestResult } from '../src/test-runner.js'
import { createMockEmitter, createSwarmConfig } from './__test-utils__/factories.js'

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

  beforeEach(() => {
    ctx = createSessionContext()
    mockDriver = createMockDriver()
    registry = createMockRegistry(mockDriver)
  })

  it('runs code review and security review in parallel', async () => {
    const changedFiles = ['src/index.ts']
    const specContext = 'Some spec context'
    const testResult = createTestResult()

    await expect(
      runReviewPhase(ctx, registry, changedFiles, specContext, testResult)
    ).rejects.toThrow('Not implemented')
  })

  it('invokes merge agent after reviews', async () => {
    const changedFiles = ['src/index.ts']
    const specContext = 'Some spec context'
    const testResult = createTestResult()

    await expect(
      runReviewPhase(ctx, registry, changedFiles, specContext, testResult)
    ).rejects.toThrow('Not implemented')
  })

  it('emits agent:invoke and agent:result events', async () => {
    const changedFiles = ['src/index.ts']
    const specContext = 'Some spec context'
    const testResult = createTestResult()

    await expect(
      runReviewPhase(ctx, registry, changedFiles, specContext, testResult)
    ).rejects.toThrow('Not implemented')
  })

  it('filters sensitive files from diff (DL-SC-5: .env*, *.pem, *.key)', async () => {
    const changedFiles = ['src/index.ts', '.env.local', 'certs/server.pem', 'keys/private.key']
    const specContext = 'Some spec context'
    const testResult = createTestResult()

    await expect(
      runReviewPhase(ctx, registry, changedFiles, specContext, testResult)
    ).rejects.toThrow('Not implemented')
  })

  it('truncates specItemContext to 4KB', async () => {
    const changedFiles = ['src/index.ts']
    const longSpec = 'x'.repeat(8192) // 8KB, should be truncated to 4KB
    const testResult = createTestResult()

    await expect(
      runReviewPhase(ctx, registry, changedFiles, longSpec, testResult)
    ).rejects.toThrow('Not implemented')
  })

  it('propagates AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()

    const changedFiles = ['src/index.ts']
    const specContext = 'Some spec context'
    const testResult = createTestResult()

    await expect(
      runReviewPhase(ctx, registry, changedFiles, specContext, testResult, controller.signal)
    ).rejects.toThrow('Not implemented')
  })

  it('retries retryable errors (FR-15)', async () => {
    const changedFiles = ['src/index.ts']
    const specContext = 'Some spec context'
    const testResult = createTestResult()

    await expect(
      runReviewPhase(ctx, registry, changedFiles, specContext, testResult)
    ).rejects.toThrow('Not implemented')
  })
})

// ---------------------------------------------------------------------------
// verifyMergeIntegrity
// ---------------------------------------------------------------------------

describe('verifyMergeIntegrity', () => {
  it('restores dropped critical findings (DL-SC-9)', () => {
    const codeFindings = [createFinding({ severity: 'critical', file: 'a.ts', line: 1, category: 'bug' })]
    const secFindings = [createFinding({ severity: 'critical', file: 'b.ts', line: 5, category: 'security' })]
    const mergedFindings: ReviewFinding[] = [] // merge agent dropped everything

    const result = verifyMergeIntegrity(codeFindings, secFindings, mergedFindings)

    expect(result.restored).toHaveLength(2)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('returns empty restored when all critical findings present', () => {
    const finding = createFinding({ severity: 'critical', file: 'a.ts', line: 1, category: 'bug' })
    const codeFindings = [finding]
    const secFindings: ReviewFinding[] = []
    const mergedFindings = [finding]

    const result = verifyMergeIntegrity(codeFindings, secFindings, mergedFindings)

    expect(result.restored).toHaveLength(0)
  })

  it('generates warnings for dropped findings', () => {
    const droppedFinding = createFinding({ severity: 'critical', file: 'dropped.ts', line: 42, category: 'security' })
    const codeFindings = [droppedFinding]
    const secFindings: ReviewFinding[] = []
    const mergedFindings: ReviewFinding[] = [] // dropped

    const result = verifyMergeIntegrity(codeFindings, secFindings, mergedFindings)

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

    const result = verifyMergeIntegrity([original], [], [merged])

    expect(result.restored).toHaveLength(0)
  })
})

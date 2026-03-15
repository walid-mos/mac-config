import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runDocsPhase } from '../../../src/phases/docs/docs-phase.js'
import type { SessionContext, SessionId } from '../../../src/core/types.js'
import type { DriverRegistry } from '../../../src/drivers/driver.js'
import type { CodePhaseResult, PlanPhaseResult } from '../../../src/phases/phase-results.js'
import {
  createMockChildProcess,
  createMockEmitter,
  createSwarmConfig,
  createSwarmState,
} from '../../__test-utils__/factories.js'

vi.mock('../../../src/phases/phase-results.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/phases/phase-results.js')>()
  return {
    ...actual,
    readPlanPhaseResult: vi.fn(),
    readTddPhaseResult: vi.fn(),
    readCodePhaseResult: vi.fn(),
  }
})

vi.mock('../../../src/phases/docs/report-builder.js', () => ({
  buildDeliveryReportInput: vi.fn().mockReturnValue({
    schemaVersion: 2,
    sessionId: 'test-session',
    specPath: '/tmp/project/spec.md',
    specItems: [],
    totalDuration: 1000,
    startedAt: '2026-01-15T10:00:00.000Z',
    completedAt: '2026-01-15T10:00:01.000Z',
  }),
}))

vi.mock('../../../src/phases/docs/iteration-log-builder.js', () => ({
  buildIterationLogArtifact: vi.fn().mockReturnValue({
    schemaVersion: 2,
    sessionId: 'test-session',
    generatedAt: '2026-01-15T10:00:01.000Z',
    entries: [],
  }),
  renderIterationLog: vi.fn().mockReturnValue('# Iterations\n\nNo iterations recorded.\n'),
}))

vi.mock('../../../src/phases/docs/fallback-report.js', () => ({
  generateFallbackReport: vi.fn().mockReturnValue('# Delivery Report\n\nGenerated automatically.'),
}))

vi.mock('../../../src/git/git-operations.js', () => ({
  commitSpecItem: vi.fn().mockResolvedValue('doc-commit-hash'),
  markPrReady: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

vi.mock('node:child_process', () => ({
  spawn: vi.fn().mockImplementation(() => {
    const proc = createMockChildProcess()
    setTimeout(() => proc.simulateOutput('', 0), 0)
    return proc
  }),
}))

const createMockRegistry = (): DriverRegistry => {
  return {
    getDriver: vi.fn(),
    checkAll: vi.fn(),
  }
}

const createCodePhaseResult = (): CodePhaseResult => ({
  waves: [],
  iterations: [],
  finalTestResult: { totalTests: 10, passingTests: 10, failingTests: 0, durationMs: 1000 },
  gitState: { branch: 'swarm/test', commits: [], prNumber: 42, prUrl: 'https://github.com/org/repo/pull/42' },
  changedFiles: ['src/index.ts'],
  success: true,
})

const createPlanPhaseResult = (): PlanPhaseResult => ({
  plannerOutput: 'plan output',
  tasks: [{ id: 'TASK-1', title: 'Task 1', description: 'Desc', tag: 'backend', dependencies: [], testHints: [] }],
  techStack: {
    languages: ['ts'],
    frameworks: [],
    testRunner: 'vitest',
    packageManager: 'pnpm',
    buildTool: 'vite',
    configFiles: [],
    testCommand: 'pnpm test',
    buildCommand: null,
    typecheckCommand: null,
    lintCommand: null,
  },
  taskCount: 1,
  tags: { backend: 1 },
})

const createSessionContext = (overrides: Partial<SessionContext> = {}): SessionContext => {
  const state = createSwarmState({
    phaseResults: {
      plan: createPlanPhaseResult(),
      code: createCodePhaseResult(),
    },
  })

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

const setupMocksWithCodeResult = async (codeResult: CodePhaseResult | null = createCodePhaseResult()): Promise<void> => {
  const { readPlanPhaseResult, readTddPhaseResult, readCodePhaseResult } = await import('../../../src/phases/phase-results.js')
  vi.mocked(readPlanPhaseResult).mockReturnValue(createPlanPhaseResult())
  vi.mocked(readTddPhaseResult).mockReturnValue(null)
  vi.mocked(readCodePhaseResult).mockReturnValue(codeResult)
}

describe('runDocsPhase', () => {
  let ctx: SessionContext
  let registry: DriverRegistry

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = createSessionContext()
    registry = createMockRegistry()
    await setupMocksWithCodeResult()
  })

  it('emits phase:start and phase:end events', async () => {
    const emitter = createMockEmitter()
    ctx = createSessionContext({ emitter })

    await runDocsPhase(ctx, registry)

    expect(emitter.getEvents({ type: 'phase:start' })).toHaveLength(1)
    expect(emitter.getEvents({ type: 'phase:end' })).toHaveLength(1)
  })

  it('writes json artifacts before markdown artifacts', async () => {
    const { writeFileSync } = await import('node:fs')

    await runDocsPhase(ctx, registry)

    const calls = vi.mocked(writeFileSync).mock.calls.map((call) => String(call[0]))
    expect(calls[0]).toContain('delivery-report.json')
    expect(calls[1]).toContain('delivery-report.md')
    expect(calls[2]).toContain('iterations.json')
    expect(calls[3]).toContain('iterations.md')
  })

  it('uses session-scoped artifact paths', async () => {
    const result = await runDocsPhase(ctx, registry)

    expect(result.deliveryReportJsonPath).toContain('.swarm/artifacts/test-session/delivery-report.json')
    expect(result.iterationLogMarkdownPath).toContain('.swarm/artifacts/test-session/iterations.md')
  })

  it('commits all generated artifacts', async () => {
    const { commitSpecItem } = await import('../../../src/git/git-operations.js')

    await runDocsPhase(ctx, registry)

    expect(commitSpecItem).toHaveBeenCalledWith(
      '/tmp/project',
      [
        '.swarm/artifacts/test-session/delivery-report.json',
        '.swarm/artifacts/test-session/delivery-report.md',
        '.swarm/artifacts/test-session/iterations.json',
        '.swarm/artifacts/test-session/iterations.md',
      ],
      'docs(swarm): add delivery report artifacts'
    )
  })

  it('updates the PR body from rendered markdown', async () => {
    const { spawn } = await import('node:child_process')

    await runDocsPhase(ctx, registry)

    expect(vi.mocked(spawn).mock.calls.some((call) => call[0] === 'gh')).toBe(true)
  })

  it('marks the PR ready when a PR exists', async () => {
    const { markPrReady } = await import('../../../src/git/git-operations.js')

    await runDocsPhase(ctx, registry)

    expect(markPrReady).toHaveBeenCalledWith(42, '/tmp/project')
  })

  it('skips PR operations when no PR exists', async () => {
    const codeResult = createCodePhaseResult()
    codeResult.gitState.prNumber = undefined
    codeResult.gitState.prUrl = undefined
    await setupMocksWithCodeResult(codeResult)
    const { spawn } = await import('node:child_process')
    const { markPrReady } = await import('../../../src/git/git-operations.js')

    await runDocsPhase(ctx, registry)

    expect(spawn).not.toHaveBeenCalled()
    expect(markPrReady).not.toHaveBeenCalled()
  })

  it('truncates oversized PR bodies', async () => {
    const { generateFallbackReport } = await import('../../../src/phases/docs/fallback-report.js')
    vi.mocked(generateFallbackReport).mockReturnValue('x'.repeat(70_000))
    const { spawn } = await import('node:child_process')

    await runDocsPhase(ctx, registry)

    expect(vi.mocked(spawn).mock.calls).toHaveLength(1)
  })

  it('propagates abort before any file generation', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(runDocsPhase(ctx, registry, controller.signal)).rejects.toThrow('aborted')
  })

  it('handles missing code phase result', async () => {
    await setupMocksWithCodeResult(null)

    await expect(runDocsPhase(ctx, registry)).rejects.toThrow('Missing code phase result')
  })

  it('returns artifact paths in DocsPhaseResult', async () => {
    const result = await runDocsPhase(ctx, registry)

    expect(result).toEqual(expect.objectContaining({
      deliveryReportJsonPath: expect.any(String),
      deliveryReportMarkdownPath: expect.any(String),
      iterationLogJsonPath: expect.any(String),
      iterationLogMarkdownPath: expect.any(String),
      success: true,
    }))
  })
})

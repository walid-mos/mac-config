import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runTddPhase } from '../../../src/phases/tdd/tdd-phase.js'
import type { PlanPhaseResult, TddPhaseResult, TddAgentOutput } from '../../../src/phases/phase-results.js'
import type { SessionContext, SessionId, ModelId, SwarmStateManager } from '../../../src/core/types.js'
import type { DriverRegistry, Driver, AgentResult, BackendName } from '../../../src/drivers/driver.js'
import {
  createSwarmConfig,
  createMockEmitter,
} from '../../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Mock internal dependencies
// ---------------------------------------------------------------------------

vi.mock('../../../src/phases/tdd/test-prompt.js', () => ({
  buildTestPrompt: vi.fn(),
}))

vi.mock('../../../src/drivers/output-parser.js', () => ({
  parseStructuredOutput: vi.fn(),
}))

import { buildTestPrompt } from '../../../src/phases/tdd/test-prompt.js'
import { parseStructuredOutput } from '../../../src/drivers/output-parser.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createAgentOutput(overrides: Partial<TddAgentOutput> = {}): TddAgentOutput {
  return {
    testFiles: ['tests/feature.test.ts'],
    testResult: { totalTests: 5, passingTests: 0, failingTests: 5, durationMs: 300 },
    isRed: true,
    ...overrides,
  }
}

function createSuccessAgentResult(output: string): AgentResult {
  return {
    success: true,
    output,
    rawOutput: output,
    stderr: '',
    model: 'opus' as ModelId,
    backend: 'claude' as BackendName,
    durationMs: 2000,
  }
}

function createMockDriver(result: AgentResult): Driver {
  return {
    name: 'claude',
    invoke: vi.fn().mockResolvedValue(result),
    checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
  }
}

function createMockDriverRegistry(invokeResult: AgentResult): DriverRegistry {
  const mockDriver = createMockDriver(invokeResult)
  return {
    getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
    checkAll: vi.fn().mockResolvedValue({}),
  }
}

function createMockStateManager(): SwarmStateManager {
  return {
    load: vi.fn().mockReturnValue({ found: false, reason: 'missing' as const }),
    save: vi.fn(),
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
  }
}

function createSessionContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    sessionId: 'test-session' as SessionId,
    config: { config: createSwarmConfig(), resolvedFrom: 'defaults' },
    emitter: createMockEmitter(),
    state: createMockStateManager(),
    specPath: '/tmp/project/spec.md',
    projectDir: '/tmp/project',
    dryRun: false,
    ...overrides,
  }
}

function createPlanPhaseResult(overrides: Partial<PlanPhaseResult> = {}): PlanPhaseResult {
  return {
    plannerOutput: '## Task Decomposition\n### TASK-1: Feature\n...',
    tasks: [{
      id: 'TASK-1' as `TASK-${number}`,
      title: 'Implement feature',
      description: 'Feature implementation',
      tag: 'backend',
      dependencies: [] as `TASK-${number}`[],
      testHints: ['test feature behavior'],
    }],
    techStack: {
      languages: ['typescript'],
      frameworks: [],
      testRunner: 'vitest',
      packageManager: 'pnpm',
      buildTool: null,
      configFiles: ['tsconfig.json'],
      testCommand: 'vitest run',
      buildCommand: null,
    },
    taskCount: 1,
    tags: { backend: 1 },
    ...overrides,
  }
}

const AGENT_OUTPUT_JSON = JSON.stringify(createAgentOutput())

function mockParserReturns(output: TddAgentOutput): void {
  vi.mocked(parseStructuredOutput).mockReturnValue({
    ok: true,
    output: JSON.stringify(output),
    strategy: 'fence-strip',
  })
}

beforeEach(() => {
  vi.mocked(buildTestPrompt).mockReturnValue('test agent prompt content')
  mockParserReturns(createAgentOutput())
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

describe('runTddPhase — event emission', () => {
  it('emits phase:start with { phase: "tdd" }', async () => {
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    const startEvents = emitter.events.filter(e => e.type === 'phase:start')
    expect(startEvents.length).toBeGreaterThan(0)
    expect((startEvents[0] as { data: { phase: string } }).data.phase).toBe('tdd')
  })

  it('emits phase:end with { phase: "tdd", durationMs }', async () => {
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    const endEvents = emitter.events.filter(e => e.type === 'phase:end')
    expect(endEvents.length).toBeGreaterThan(0)
    const endData = (endEvents[0] as { data: { phase: string; durationMs: number } }).data
    expect(endData.phase).toBe('tdd')
    expect(typeof endData.durationMs).toBe('number')
  })

  it('emits test:red when agent reports isRed=true', async () => {
    mockParserReturns(createAgentOutput({
      testResult: { totalTests: 8, passingTests: 2, failingTests: 6, durationMs: 0 },
      isRed: true,
    }))
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    const redEvents = emitter.events.filter(e => e.type === 'test:red')
    expect(redEvents.length).toBeGreaterThan(0)
    const redData = (redEvents[0] as { data: { totalTests: number; passingTests: number; failingTests: number } }).data
    expect(redData.totalTests).toBe(8)
    expect(redData.passingTests).toBe(2)
    expect(redData.failingTests).toBe(6)
  })

  it('emits test:green when agent reports isRed=false with tests', async () => {
    mockParserReturns(createAgentOutput({
      testResult: { totalTests: 5, passingTests: 5, failingTests: 0, durationMs: 0 },
      isRed: false,
    }))
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    // All retries exhausted on isRed=false — on final attempt it emits test:green
    const mockDriver = createMockDriver(createSuccessAgentResult(AGENT_OUTPUT_JSON))
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    const greenEvents = emitter.events.filter(e => e.type === 'test:green')
    expect(greenEvents.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Internal orchestration
// ---------------------------------------------------------------------------

describe('runTddPhase — internal orchestration', () => {
  it('calls buildTestPrompt with plan data', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))
    const plan = createPlanPhaseResult()

    await runTddPhase(ctx, registry, plan)

    expect(buildTestPrompt).toHaveBeenCalledWith(
      plan.plannerOutput,
      plan.tasks,
      plan.techStack,
      expect.any(Array)
    )
  })

  it('invokes test agent via registry.getDriver("test")', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(registry.getDriver).toHaveBeenCalledWith('test')
  })

  it('parses agent JSON output via parseStructuredOutput', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(parseStructuredOutput).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Return value
// ---------------------------------------------------------------------------

describe('runTddPhase — return value', () => {
  it('returns TddPhaseResult with testFiles and agentReport', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    const result = await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(result).toHaveProperty('testFiles')
    expect(result).toHaveProperty('agentReport')
    expect(Array.isArray(result.testFiles)).toBe(true)
    expect(result.agentReport).toHaveProperty('isRed')
  })

  it('TddPhaseResult is always persisted regardless of RED/GREEN outcome', async () => {
    mockParserReturns(createAgentOutput({
      isRed: false,
      testResult: { totalTests: 5, passingTests: 5, failingTests: 0, durationMs: 0 },
    }))
    const ctx = createSessionContext()
    const mockDriver = createMockDriver(createSuccessAgentResult(AGENT_OUTPUT_JSON))
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    const result = await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(result).toBeDefined()
    expect(result.agentReport).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Retry behavior
// ---------------------------------------------------------------------------

describe('runTddPhase — retry on zero tests', () => {
  it('retries when agent reports 0 tests on non-final attempt', async () => {
    const zeroOutput = createAgentOutput({ testResult: { totalTests: 0, passingTests: 0, failingTests: 0, durationMs: 0 }, isRed: false })
    const goodOutput = createAgentOutput()

    vi.mocked(parseStructuredOutput)
      .mockReturnValueOnce({ ok: true, output: JSON.stringify(zeroOutput), strategy: 'fence-strip' })
      .mockReturnValue({ ok: true, output: JSON.stringify(goodOutput), strategy: 'fence-strip' })

    const ctx = createSessionContext()
    const mockDriver = createMockDriver(createSuccessAgentResult(AGENT_OUTPUT_JSON))
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    const result = await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(mockDriver.invoke).toHaveBeenCalledTimes(2)
    expect(result.agentReport.testResult.totalTests).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// AgentResult error handling (FR-11)
// ---------------------------------------------------------------------------

describe('runTddPhase — AgentResult error handling (FR-11)', () => {
  it('retries on timeout up to 2 times', async () => {
    const ctx = createSessionContext()
    const timeoutResult: AgentResult = {
      success: false,
      errorCode: 'timeout',
      error: 'Agent timed out',
      rawOutput: '',
      stderr: '',
      model: 'opus' as ModelId,
      backend: 'claude' as BackendName,
      durationMs: 60000,
    }

    const mockDriver: Driver = {
      name: 'claude',
      invoke: vi.fn()
        .mockResolvedValueOnce(timeoutResult)
        .mockResolvedValueOnce(timeoutResult)
        .mockResolvedValue(createSuccessAgentResult(AGENT_OUTPUT_JSON)),
      checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
    }
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(mockDriver.invoke).toHaveBeenCalledTimes(3)
  })

  it('propagates aborted immediately and emits phase:error', async () => {
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const abortedResult: AgentResult = {
      success: false,
      errorCode: 'aborted',
      error: 'Cancelled',
      rawOutput: '',
      stderr: '',
      model: 'opus' as ModelId,
      backend: 'claude' as BackendName,
      durationMs: 50,
    }

    const mockDriver: Driver = {
      name: 'claude',
      invoke: vi.fn().mockResolvedValue(abortedResult),
      checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
    }
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    await expect(
      runTddPhase(ctx, registry, createPlanPhaseResult())
    ).rejects.toThrow()

    expect(mockDriver.invoke).toHaveBeenCalledTimes(1)
    const phaseErrors = emitter.events.filter(e => e.type === 'phase:error')
    expect(phaseErrors.length).toBeGreaterThan(0)
  })

  it('aborts immediately on spawn_error and emits phase:error', async () => {
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const spawnErrorResult: AgentResult = {
      success: false,
      errorCode: 'spawn_error',
      error: 'Binary not found',
      rawOutput: '',
      stderr: 'ENOENT',
      model: 'opus' as ModelId,
      backend: 'claude' as BackendName,
      durationMs: 10,
    }

    const mockDriver: Driver = {
      name: 'claude',
      invoke: vi.fn().mockResolvedValue(spawnErrorResult),
      checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
    }
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    await expect(
      runTddPhase(ctx, registry, createPlanPhaseResult())
    ).rejects.toThrow()

    expect(mockDriver.invoke).toHaveBeenCalledTimes(1)
    const phaseErrors = emitter.events.filter(e => e.type === 'phase:error')
    expect(phaseErrors.length).toBeGreaterThan(0)
  })

  it('emits phase:error when all retries exhausted', async () => {
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const crashResult: AgentResult = {
      success: false,
      errorCode: 'crash',
      error: 'Keep crashing',
      rawOutput: '',
      stderr: '',
      model: 'opus' as ModelId,
      backend: 'claude' as BackendName,
      durationMs: 100,
    }

    const mockDriver: Driver = {
      name: 'claude',
      invoke: vi.fn().mockResolvedValue(crashResult),
      checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
    }
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    await expect(
      runTddPhase(ctx, registry, createPlanPhaseResult())
    ).rejects.toThrow()

    const phaseErrors = emitter.events.filter(e => e.type === 'phase:error')
    expect(phaseErrors.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Zero-test guard
// ---------------------------------------------------------------------------

describe('runTddPhase — zero-test guard', () => {
  it('returns gracefully with 0 tests after all retries (does not throw)', async () => {
    const zeroOutput = createAgentOutput({
      testResult: { totalTests: 0, passingTests: 0, failingTests: 0, durationMs: 0 },
      isRed: false,
    })
    vi.mocked(parseStructuredOutput).mockReturnValue({
      ok: true,
      output: JSON.stringify(zeroOutput),
      strategy: 'fence-strip',
    })

    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    const result = await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(result.agentReport.testResult.totalTests).toBe(0)
  })

  it('emits test:fail when 0 tests on last retry', async () => {
    const zeroOutput = createAgentOutput({
      testResult: { totalTests: 0, passingTests: 0, failingTests: 0, durationMs: 0 },
      isRed: false,
    })
    vi.mocked(parseStructuredOutput).mockReturnValue({
      ok: true,
      output: JSON.stringify(zeroOutput),
      strategy: 'fence-strip',
    })

    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    const failEvents = emitter.events.filter(e => e.type === 'test:fail')
    expect(failEvents.length).toBeGreaterThan(0)
  })

  it('emits phase:end even when 0 tests', async () => {
    const zeroOutput = createAgentOutput({
      testResult: { totalTests: 0, passingTests: 0, failingTests: 0, durationMs: 0 },
      isRed: false,
    })
    vi.mocked(parseStructuredOutput).mockReturnValue({
      ok: true,
      output: JSON.stringify(zeroOutput),
      strategy: 'fence-strip',
    })

    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    const endEvents = emitter.events.filter(e => e.type === 'phase:end')
    expect(endEvents.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// AbortSignal
// ---------------------------------------------------------------------------

describe('runTddPhase — AbortSignal', () => {
  it('respects AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()

    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT_JSON))

    await expect(
      runTddPhase(ctx, registry, createPlanPhaseResult(), controller.signal)
    ).rejects.toThrow()
  })
})

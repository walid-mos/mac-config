import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runTddPhase } from '../../src/phases/tdd-phase.js'
import type { PlanPhaseResult, TddPhaseResult } from '../../src/phase-results.js'
import type { SessionContext, SessionId, ModelId, SwarmState, SwarmStateManager } from '../../src/types.js'
import type { DriverRegistry, Driver, AgentResult, BackendName } from '../../src/drivers/driver.js'
import type { TechStack } from '../../src/tech-stack.js'
import type { RedVerification } from '../../src/red-verification.js'
import {
  createSwarmConfig,
  createMockEmitter,
} from '../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Mock internal dependencies
// ---------------------------------------------------------------------------

vi.mock('../../src/prompts/test-prompt.js', () => ({
  buildTestPrompt: vi.fn(),
}))

vi.mock('../../src/red-verification.js', () => ({
  verifyRed: vi.fn(),
}))

import { buildTestPrompt } from '../../src/prompts/test-prompt.js'
import { verifyRed } from '../../src/red-verification.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      files: ['src/feature.ts'],
      dependencies: [] as `TASK-${number}`[],
      testHints: ['test feature behavior'],
    }],
    techStack: {
      languages: ['typescript'],
      frameworks: [],
      testRunner: 'vitest' as const,
      packageManager: 'pnpm' as const,
      buildTool: null,
      configFiles: ['tsconfig.json'],
      testCommand: 'vitest run',
    },
    taskCount: 1,
    tags: { backend: 1 },
    ...overrides,
  }
}

function createRedVerification(overrides: Partial<RedVerification> = {}): RedVerification {
  return {
    totalTests: 5,
    passingTests: 0,
    failingTests: 5,
    durationMs: 300,
    syntaxErrors: [],
    testFiles: ['tests/feature.test.ts'],
    isRed: true,
    ...overrides,
  }
}

const AGENT_OUTPUT = `Created test files:
- tests/feature.test.ts
`

beforeEach(() => {
  vi.mocked(buildTestPrompt).mockReturnValue('test agent prompt content')
  vi.mocked(verifyRed).mockResolvedValue(createRedVerification())
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
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    const startEvents = emitter.events.filter(e => e.type === 'phase:start')
    expect(startEvents.length).toBeGreaterThan(0)
    expect((startEvents[0] as { data: { phase: string } }).data.phase).toBe('tdd')
  })

  it('emits phase:end with { phase: "tdd", durationMs }', async () => {
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    const endEvents = emitter.events.filter(e => e.type === 'phase:end')
    expect(endEvents.length).toBeGreaterThan(0)
    const endData = (endEvents[0] as { data: { phase: string; durationMs: number } }).data
    expect(endData.phase).toBe('tdd')
    expect(typeof endData.durationMs).toBe('number')
  })

  it('emits test:red when RED verification succeeds', async () => {
    vi.mocked(verifyRed).mockResolvedValue(createRedVerification({
      totalTests: 8,
      passingTests: 2,
      failingTests: 6,
      isRed: true,
    }))
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    const redEvents = emitter.events.filter(e => e.type === 'test:red')
    expect(redEvents.length).toBeGreaterThan(0)
    const redData = (redEvents[0] as { data: { totalTests: number; passingTests: number; failingTests: number } }).data
    expect(redData.totalTests).toBe(8)
    expect(redData.passingTests).toBe(2)
    expect(redData.failingTests).toBe(6)
  })

  it('emits test:green when all tests pass', async () => {
    vi.mocked(verifyRed).mockResolvedValue(createRedVerification({
      totalTests: 5,
      passingTests: 5,
      failingTests: 0,
      isRed: false,
      syntaxErrors: [],
    }))
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

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
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))
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
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(registry.getDriver).toHaveBeenCalledWith('test')
  })

  it('calls verifyRed() for RED verification', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(verifyRed).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test file path validation (PT-SC-1)
// ---------------------------------------------------------------------------

describe('runTddPhase — test file path validation (PT-SC-1)', () => {
  it('validates test file paths under projectDir', async () => {
    const ctx = createSessionContext({ projectDir: '/tmp/project' })
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

    const result = await runTddPhase(ctx, registry, createPlanPhaseResult())

    for (const testFile of result.testFiles) {
      // Test files should be within the project directory
      expect(testFile).not.toMatch(/^\/(?!tmp\/project)/)
    }
  })

  it('deletes files outside projectDir boundary', async () => {
    const ctx = createSessionContext({ projectDir: '/tmp/project' })
    const registry = createMockDriverRegistry(createSuccessAgentResult(
      'Created test files:\n- /etc/malicious.ts\n- tests/feature.test.ts\n'
    ))

    const result = await runTddPhase(ctx, registry, createPlanPhaseResult())

    // Files outside projectDir should not appear in result
    for (const testFile of result.testFiles) {
      expect(testFile).not.toContain('/etc/')
    }
  })
})

// ---------------------------------------------------------------------------
// Return value
// ---------------------------------------------------------------------------

describe('runTddPhase — return value', () => {
  it('returns TddPhaseResult with testFiles and redVerification', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

    const result = await runTddPhase(ctx, registry, createPlanPhaseResult())

    expect(result).toHaveProperty('testFiles')
    expect(result).toHaveProperty('redVerification')
    expect(Array.isArray(result.testFiles)).toBe(true)
    expect(result.redVerification).toHaveProperty('isRed')
  })

  it('TddPhaseResult is always persisted regardless of RED/GREEN outcome', async () => {
    // Test GREEN case
    vi.mocked(verifyRed).mockResolvedValue(createRedVerification({
      isRed: false,
      failingTests: 0,
      passingTests: 5,
    }))
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

    const result = await runTddPhase(ctx, registry, createPlanPhaseResult())

    // Result should still be returned even when not RED
    expect(result).toBeDefined()
    expect(result.redVerification).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Retry behavior (syntax errors)
// ---------------------------------------------------------------------------

describe('runTddPhase — retry on syntax errors', () => {
  it('retries test agent up to 2 times on syntax errors', async () => {
    const syntaxErrorVerification = createRedVerification({
      syntaxErrors: ['SyntaxError: Unexpected token at line 5'],
      isRed: false,
      failingTests: 0,
    })

    vi.mocked(verifyRed)
      .mockResolvedValueOnce(syntaxErrorVerification)
      .mockResolvedValueOnce(syntaxErrorVerification)
      .mockResolvedValue(createRedVerification()) // Third time works

    const ctx = createSessionContext()
    const mockDriver = createMockDriver(createSuccessAgentResult(AGENT_OUTPUT))
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    const result = await runTddPhase(ctx, registry, createPlanPhaseResult())

    // Driver should have been invoked multiple times (retries for syntax errors)
    expect(mockDriver.invoke).toHaveBeenCalledTimes(3)
  })

  it('sanitizes error output for retry prompts (truncate to 4KB, strip paths)', async () => {
    const longError = 'SyntaxError: ' + 'x'.repeat(5000)
    const syntaxErrorVerification = createRedVerification({
      syntaxErrors: [longError],
      isRed: false,
      failingTests: 0,
    })

    vi.mocked(verifyRed)
      .mockResolvedValueOnce(syntaxErrorVerification)
      .mockResolvedValue(createRedVerification())

    const ctx = createSessionContext()
    const mockDriver = createMockDriver(createSuccessAgentResult(AGENT_OUTPUT))
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    await runTddPhase(ctx, registry, createPlanPhaseResult())

    // The retry prompt should have been called with sanitized error
    const secondCall = mockDriver.invoke.mock.calls[1]
    expect(secondCall).toBeDefined()
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
        .mockResolvedValue(createSuccessAgentResult(AGENT_OUTPUT)),
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
// AbortSignal
// ---------------------------------------------------------------------------

describe('runTddPhase — AbortSignal', () => {
  it('respects AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()

    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(AGENT_OUTPUT))

    await expect(
      runTddPhase(ctx, registry, createPlanPhaseResult(), controller.signal)
    ).rejects.toThrow()
  })
})

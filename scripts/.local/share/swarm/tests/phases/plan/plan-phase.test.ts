import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runPlanPhase } from '../../../src/phases/plan/plan-phase.js'
import type { PlanPhaseResult } from '../../../src/phases/phase-results.js'
import type { SessionContext, SessionId, ModelId, SwarmState, SwarmStateManager, SwarmEvent } from '../../../src/core/types.js'
import type { DriverRegistry, Driver, AgentResult, BackendName } from '../../../src/drivers/driver.js'
import {
  createSwarmConfig,
  createSwarmState,
  createMockEmitter,
} from '../../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Mock internal dependencies
// ---------------------------------------------------------------------------

vi.mock('../../../src/phases/plan/planner-prompt.js', () => ({
  buildPlannerPrompt: vi.fn(),
}))

vi.mock('../../../src/phases/plan/task-parser.js', () => ({
  parseTaskDecomposition: vi.fn(),
  parseTechStack: vi.fn(),
}))

import { buildPlannerPrompt } from '../../../src/phases/plan/planner-prompt.js'
import { parseTaskDecomposition, parseTechStack } from '../../../src/phases/plan/task-parser.js'

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
    durationMs: 1000,
  }
}

function createFailureAgentResult(errorCode: AgentResult extends { success: false } ? never : never, overrides: Partial<Extract<AgentResult, { success: false }>> = {}): Extract<AgentResult, { success: false }> {
  return {
    success: false,
    errorCode: 'crash',
    error: 'Agent crashed',
    rawOutput: '',
    stderr: 'crash trace',
    model: 'opus' as ModelId,
    backend: 'claude' as BackendName,
    durationMs: 500,
    ...overrides,
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
  const store: { state: SwarmState | null } = { state: null }
  return {
    load: vi.fn().mockReturnValue({ found: false, reason: 'missing' as const }),
    save: vi.fn().mockImplementation((state: SwarmState) => { store.state = state }),
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

const VALID_PLANNER_OUTPUT = `## Tech Stack
- **Package Manager**: pnpm
- **Test Command**: pnpm exec vitest run
- **Build Command**: none
- **Languages**: typescript
- **Frameworks**: none
- **Test Runner**: vitest
- **Build Tool**: none
- **Config Files**: tsconfig.json

## Task Decomposition

### TASK-1: Setup API
- **Tag**: backend
- **Files**: src/api.ts
- **Dependencies**: none
- **Description**: Set up API
- **Test hints**: test API
`

const VALID_TECH_STACK = {
  languages: ['typescript'],
  frameworks: [],
  testRunner: 'vitest',
  packageManager: 'pnpm',
  buildTool: null,
  configFiles: ['tsconfig.json'],
  testCommand: 'pnpm exec vitest run',
  buildCommand: null,
  typecheckCommand: null,
  lintCommand: null,
}

const VALID_TASKS = [{
  id: 'TASK-1' as `TASK-${number}`,
  title: 'Setup API',
  description: 'Set up API',
  tag: 'backend' as const,
  dependencies: [] as `TASK-${number}`[],
  testHints: ['test API'],
}]

beforeEach(() => {
  vi.mocked(buildPlannerPrompt).mockReturnValue('planner prompt content')
  vi.mocked(parseTaskDecomposition).mockReturnValue({
    tasks: VALID_TASKS,
    warnings: [],
  })
  vi.mocked(parseTechStack).mockReturnValue(VALID_TECH_STACK)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

describe('runPlanPhase — event emission', () => {
  it('emits phase:start with { phase: "plan" }', async () => {
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(VALID_PLANNER_OUTPUT))

    await runPlanPhase(ctx, registry, 'spec content')

    const startEvents = emitter.events.filter(e => e.type === 'phase:start')
    expect(startEvents.length).toBeGreaterThan(0)
    expect((startEvents[0] as { data: { phase: string } }).data.phase).toBe('plan')
  })

  it('emits phase:end with { phase: "plan", durationMs, taskCount }', async () => {
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>
    const registry = createMockDriverRegistry(createSuccessAgentResult(VALID_PLANNER_OUTPUT))

    await runPlanPhase(ctx, registry, 'spec content')

    const endEvents = emitter.events.filter(e => e.type === 'phase:end')
    expect(endEvents.length).toBeGreaterThan(0)
    const endData = (endEvents[0] as { data: { phase: string; durationMs: number; taskCount?: number } }).data
    expect(endData.phase).toBe('plan')
    expect(typeof endData.durationMs).toBe('number')
    expect(endData.taskCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Internal function calls
// ---------------------------------------------------------------------------

describe('runPlanPhase — internal orchestration', () => {
  it('calls buildPlannerPrompt with spec content and project structure', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(VALID_PLANNER_OUTPUT))

    await runPlanPhase(ctx, registry, 'my spec content')

    expect(buildPlannerPrompt).toHaveBeenCalledWith(
      'my spec content',
      expect.any(Array)
    )
  })

  it('invokes planner agent via registry.getDriver("plan")', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(VALID_PLANNER_OUTPUT))

    await runPlanPhase(ctx, registry, 'spec content')

    expect(registry.getDriver).toHaveBeenCalledWith('plan')
  })

  it('parses output via parseTaskDecomposition()', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(VALID_PLANNER_OUTPUT))

    await runPlanPhase(ctx, registry, 'spec content')

    expect(parseTaskDecomposition).toHaveBeenCalledWith(
      VALID_PLANNER_OUTPUT,
      ctx.projectDir
    )
  })

  it('calls parseTechStack with planner output', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(VALID_PLANNER_OUTPUT))

    await runPlanPhase(ctx, registry, 'spec content')

    expect(parseTechStack).toHaveBeenCalledWith(VALID_PLANNER_OUTPUT)
  })
})

// ---------------------------------------------------------------------------
// Return value
// ---------------------------------------------------------------------------

describe('runPlanPhase — return value', () => {
  it('returns PlanPhaseResult with plannerOutput, tasks, techStack, taskCount, tags', async () => {
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(VALID_PLANNER_OUTPUT))

    const result = await runPlanPhase(ctx, registry, 'spec content')

    expect(result).toHaveProperty('plannerOutput')
    expect(result).toHaveProperty('tasks')
    expect(result).toHaveProperty('techStack')
    expect(result).toHaveProperty('taskCount')
    expect(result).toHaveProperty('tags')
    expect(result.tasks).toEqual(VALID_TASKS)
    expect(result.techStack).toEqual(VALID_TECH_STACK)
    expect(result.taskCount).toBe(1)
  })

  it('computes tags summary', async () => {
    vi.mocked(parseTaskDecomposition).mockReturnValue({
      tasks: [
        { ...VALID_TASKS[0]!, tag: 'backend' },
        { ...VALID_TASKS[0]!, id: 'TASK-2' as `TASK-${number}`, tag: 'backend' },
        { ...VALID_TASKS[0]!, id: 'TASK-3' as `TASK-${number}`, tag: 'frontend' },
      ],
      warnings: [],
    })
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(VALID_PLANNER_OUTPUT))

    const result = await runPlanPhase(ctx, registry, 'spec content')

    expect(result.tags).toEqual({ backend: 2, frontend: 1 })
  })
})

// ---------------------------------------------------------------------------
// Truncation
// ---------------------------------------------------------------------------

describe('runPlanPhase — output truncation', () => {
  it('truncates plannerOutput to 256KB if larger', async () => {
    const largeOutput = 'x'.repeat(300_000)
    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(largeOutput))

    // parseTaskDecomposition still works on the (potentially truncated) output
    const result = await runPlanPhase(ctx, registry, 'spec content')

    expect(result.plannerOutput.length).toBeLessThanOrEqual(256 * 1024)
  })
})

// ---------------------------------------------------------------------------
// Retry behavior
// ---------------------------------------------------------------------------

describe('runPlanPhase — retry behavior', () => {
  it('retries planner once on structural validation failure', async () => {
    const ctx = createSessionContext()

    // First call to parseTaskDecomposition throws, second succeeds
    vi.mocked(parseTaskDecomposition)
      .mockImplementationOnce(() => { throw new Error('Invalid planner output format') })
      .mockReturnValueOnce({ tasks: VALID_TASKS, warnings: [] })

    const mockDriver = createMockDriver(createSuccessAgentResult(VALID_PLANNER_OUTPUT))
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    const result = await runPlanPhase(ctx, registry, 'spec content')

    // Driver should have been invoked twice (original + retry)
    expect(mockDriver.invoke).toHaveBeenCalledTimes(2)
  })

  it('emits agent:error before retry', async () => {
    const ctx = createSessionContext()
    const emitter = ctx.emitter as ReturnType<typeof createMockEmitter>

    vi.mocked(parseTaskDecomposition)
      .mockImplementationOnce(() => { throw new Error('Invalid output') })
      .mockReturnValueOnce({ tasks: VALID_TASKS, warnings: [] })

    const mockDriver = createMockDriver(createSuccessAgentResult(VALID_PLANNER_OUTPUT))
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    await runPlanPhase(ctx, registry, 'spec content')

    const errorEvents = emitter.events.filter(e => e.type === 'agent:error')
    expect(errorEvents.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// AgentResult error handling (FR-11)
// ---------------------------------------------------------------------------

describe('runPlanPhase — AgentResult error handling (FR-11)', () => {
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
        .mockResolvedValue(createSuccessAgentResult(VALID_PLANNER_OUTPUT)),
      checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
    }
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    const result = await runPlanPhase(ctx, registry, 'spec content')

    expect(mockDriver.invoke).toHaveBeenCalledTimes(3) // 1 original + 2 retries
  })

  it('retries on crash up to 2 times', async () => {
    const ctx = createSessionContext()
    const crashResult: AgentResult = {
      success: false,
      errorCode: 'crash',
      error: 'Agent crashed',
      rawOutput: '',
      stderr: 'segfault',
      model: 'opus' as ModelId,
      backend: 'claude' as BackendName,
      durationMs: 100,
    }

    const mockDriver: Driver = {
      name: 'claude',
      invoke: vi.fn()
        .mockResolvedValueOnce(crashResult)
        .mockResolvedValueOnce(crashResult)
        .mockResolvedValue(createSuccessAgentResult(VALID_PLANNER_OUTPUT)),
      checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
    }
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    const result = await runPlanPhase(ctx, registry, 'spec content')

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

    await expect(runPlanPhase(ctx, registry, 'spec content')).rejects.toThrow()

    // Should not retry
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

    await expect(runPlanPhase(ctx, registry, 'spec content')).rejects.toThrow()

    expect(mockDriver.invoke).toHaveBeenCalledTimes(1)
    const phaseErrors = emitter.events.filter(e => e.type === 'phase:error')
    expect(phaseErrors.length).toBeGreaterThan(0)
  })

  it('retries on empty_output up to 2 times', async () => {
    const ctx = createSessionContext()
    const emptyResult: AgentResult = {
      success: false,
      errorCode: 'empty_output',
      error: 'No output',
      rawOutput: '',
      stderr: '',
      model: 'opus' as ModelId,
      backend: 'claude' as BackendName,
      durationMs: 500,
    }

    const mockDriver: Driver = {
      name: 'claude',
      invoke: vi.fn()
        .mockResolvedValueOnce(emptyResult)
        .mockResolvedValueOnce(emptyResult)
        .mockResolvedValue(createSuccessAgentResult(VALID_PLANNER_OUTPUT)),
      checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
    }
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    const result = await runPlanPhase(ctx, registry, 'spec content')

    expect(mockDriver.invoke).toHaveBeenCalledTimes(3)
  })

  it('retries on invalid_json up to 2 times', async () => {
    const ctx = createSessionContext()
    const invalidJsonResult: AgentResult = {
      success: false,
      errorCode: 'invalid_json',
      error: 'Malformed JSON',
      rawOutput: '{invalid',
      stderr: '',
      model: 'opus' as ModelId,
      backend: 'claude' as BackendName,
      durationMs: 500,
    }

    const mockDriver: Driver = {
      name: 'claude',
      invoke: vi.fn()
        .mockResolvedValueOnce(invalidJsonResult)
        .mockResolvedValueOnce(invalidJsonResult)
        .mockResolvedValue(createSuccessAgentResult(VALID_PLANNER_OUTPUT)),
      checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
    }
    const registry: DriverRegistry = {
      getDriver: vi.fn().mockReturnValue({ driver: mockDriver, model: 'opus' as ModelId }),
      checkAll: vi.fn().mockResolvedValue({}),
    }

    const result = await runPlanPhase(ctx, registry, 'spec content')

    expect(mockDriver.invoke).toHaveBeenCalledTimes(3)
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

    await expect(runPlanPhase(ctx, registry, 'spec content')).rejects.toThrow()

    const phaseErrors = emitter.events.filter(e => e.type === 'phase:error')
    expect(phaseErrors.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// AbortSignal
// ---------------------------------------------------------------------------

describe('runPlanPhase — AbortSignal', () => {
  it('respects AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()

    const ctx = createSessionContext()
    const registry = createMockDriverRegistry(createSuccessAgentResult(VALID_PLANNER_OUTPUT))

    await expect(
      runPlanPhase(ctx, registry, 'spec content', controller.signal)
    ).rejects.toThrow()
  })
})

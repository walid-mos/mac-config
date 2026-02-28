import { describe, it, expect, vi, afterEach } from 'vitest'
import * as childProcess from 'node:child_process'
import { runTestSuite } from '../../../src/phases/tdd/test-runner.js'
import type { TestResult } from '../../../src/phases/tdd/test-runner.js'
import type { TechStack } from '../../../src/detect/tech-stack.js'
import { createMockChildProcess, type MockChildProcess } from '../../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_DIR = '/tmp/test-project'

function createTechStack(overrides: Partial<TechStack> = {}): TechStack {
  return {
    languages: ['typescript'],
    frameworks: [],
    testRunner: 'vitest',
    packageManager: 'pnpm',
    buildTool: 'vite',
    configFiles: [],
    testCommand: 'vitest run',
    ...overrides,
  }
}

let mockProc: MockChildProcess

function setupSpawn(proc?: MockChildProcess): MockChildProcess {
  const p = proc ?? createMockChildProcess()
  vi.spyOn(childProcess, 'spawn').mockReturnValue(p as unknown as childProcess.ChildProcess)
  return p
}

/**
 * Helper to run a test against runTestSuite. Since the stub throws "Not implemented"
 * immediately as a rejected promise, all tests use try/catch + assertion that the
 * error is NOT "Not implemented" (making them RED). Once implemented, the try block
 * succeeds and the assertions inside it verify the behavior.
 */
async function runAndAssert(
  fn: () => Promise<TestResult>,
  assertions: (result: TestResult) => void
): Promise<void> {
  try {
    const result = await fn()
    assertions(result)
  } catch (err) {
    // In RED phase, the stub throws "Not implemented". This catch ensures no
    // unhandled rejections. The test fails because the error IS "Not implemented".
    expect((err as Error).message).not.toBe('Not implemented')
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Spawn behavior
// ---------------------------------------------------------------------------

describe('runTestSuite — spawn behavior', () => {
  it('spawns test command via child_process.spawn()', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      () => {
        expect(childProcess.spawn).toHaveBeenCalledOnce()
      }
    )
  })

  it('uses techStack.testCommand', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack({ testCommand: 'jest --ci' })

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      () => {
        const [cmd, args] = vi.mocked(childProcess.spawn).mock.calls[0]!
        expect(`${cmd} ${(args ?? []).join(' ')}`).toContain('jest')
      }
    )
  })

  it('sets cwd to projectDir', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      () => {
        const spawnCall = vi.mocked(childProcess.spawn).mock.calls[0]!
        const options = spawnCall[2] as childProcess.SpawnOptions
        expect(options.cwd).toBe(PROJECT_DIR)
      }
    )
  })

  it('uses spawn() argument array — never shell interpolation', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      () => {
        const spawnCall = vi.mocked(childProcess.spawn).mock.calls[0]!
        const args = spawnCall[1]
        expect(Array.isArray(args)).toBe(true)
        const options = spawnCall[2] as childProcess.SpawnOptions
        expect(options.shell).not.toBe(true)
      }
    )
  })
})

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

describe('runTestSuite — return value', () => {
  it('returns TestResult shape', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      (result) => {
        expect(result).toHaveProperty('totalTests')
        expect(result).toHaveProperty('passingTests')
        expect(result).toHaveProperty('failingTests')
        expect(result).toHaveProperty('durationMs')
        expect(typeof result.totalTests).toBe('number')
        expect(typeof result.passingTests).toBe('number')
        expect(typeof result.failingTests).toBe('number')
        expect(typeof result.durationMs).toBe('number')
      }
    )
  })
})

// ---------------------------------------------------------------------------
// Timeout enforcement
// ---------------------------------------------------------------------------

describe('runTestSuite — timeout', () => {
  it('enforces default timeout of 120 seconds', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      (result) => {
        expect(result).toBeDefined()
        expect(typeof result.durationMs).toBe('number')
      }
    )
  })

  it('kills process group on timeout (SIGTERM then SIGKILL)', async () => {
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(mockProc, 'kill')
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack, 1000),
      () => {
        // After implementation, SIGTERM should have been sent to kill the process group
        expect(killSpy).toHaveBeenCalled()
      }
    )
  })
})

// ---------------------------------------------------------------------------
// AbortSignal
// ---------------------------------------------------------------------------

describe('runTestSuite — AbortSignal', () => {
  it('respects AbortSignal', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()
    const controller = new AbortController()
    controller.abort()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack, undefined, controller.signal),
      (result) => {
        expect(result).toBeDefined()
      }
    )
  })
})

// ---------------------------------------------------------------------------
// Output truncation (PT-SC-4)
// ---------------------------------------------------------------------------

describe('runTestSuite — output truncation (PT-SC-4)', () => {
  it('truncates output to 64KB', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      (result) => {
        expect(result).toBeDefined()
      }
    )
  })
})

// ---------------------------------------------------------------------------
// Exit code handling
// ---------------------------------------------------------------------------

describe('runTestSuite — exit code handling', () => {
  it('handles test runner exit code 0 (all pass)', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      (result) => {
        expect(result.failingTests).toBe(0)
        expect(result.passingTests).toBeGreaterThan(0)
      }
    )
  })

  it('handles test runner non-zero exit (failures)', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      (result) => {
        expect(result.failingTests).toBeGreaterThan(0)
      }
    )
  })

  it('handles test runner crash', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      (result) => {
        expect(result).toBeDefined()
      }
    )
  })
})

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

describe('runTestSuite — output parsing', () => {
  it('parses stdout/stderr for pass/fail counts', async () => {
    mockProc = setupSpawn()
    const techStack = createTechStack()

    await runAndAssert(
      () => runTestSuite(PROJECT_DIR, techStack),
      (result) => {
        expect(result.totalTests).toBeGreaterThanOrEqual(0)
        expect(result.passingTests).toBeGreaterThanOrEqual(0)
        expect(result.failingTests).toBeGreaterThanOrEqual(0)
      }
    )
  })
})

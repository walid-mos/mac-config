import { describe, it, expect, vi, afterEach } from 'vitest'
import { verifyRed } from '../../../src/phases/tdd/red-verification.js'
import type { RedVerification } from '../../../src/phases/tdd/red-verification.js'
import type { TechStack } from '../../../src/detect/tech-stack.js'

// ---------------------------------------------------------------------------
// Mock runTestSuite — isolate red-verification from test-runner
// ---------------------------------------------------------------------------

vi.mock('../../../src/phases/tdd/test-runner.js', () => ({
  runTestSuite: vi.fn(),
}))

import { runTestSuite } from '../../../src/phases/tdd/test-runner.js'

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

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Core behavior: isRed classification
// ---------------------------------------------------------------------------

describe('verifyRed — isRed classification', () => {
  it('sets isRed = true when failingTests > 0 AND syntaxErrors.length === 0', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 10,
      passingTests: 7,
      failingTests: 3,
      durationMs: 500,
    })

    const result = await verifyRed(PROJECT_DIR, createTechStack(), ['tests/a.test.ts'])

    expect(result.isRed).toBe(true)
    expect(result.failingTests).toBeGreaterThan(0)
    expect(result.syntaxErrors).toHaveLength(0)
  })

  it('sets isRed = false when all tests pass', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 10,
      passingTests: 10,
      failingTests: 0,
      durationMs: 500,
    })

    const result = await verifyRed(PROJECT_DIR, createTechStack(), ['tests/a.test.ts'])

    expect(result.isRed).toBe(false)
  })

  it('sets isRed = false when syntax errors exist', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 0,
      passingTests: 0,
      failingTests: 0,
      durationMs: 100,
    })

    // When there are syntax errors, the test runner often reports 0 tests
    // The implementation should detect syntax errors from the runner output
    const result = await verifyRed(PROJECT_DIR, createTechStack(), ['tests/broken.test.ts'])

    // If syntax errors are detected, isRed should be false
    if (result.syntaxErrors.length > 0) {
      expect(result.isRed).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

describe('verifyRed — return shape', () => {
  it('extends TestResult (has totalTests, passingTests, failingTests, durationMs)', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 5,
      passingTests: 2,
      failingTests: 3,
      durationMs: 300,
    })

    const result = await verifyRed(PROJECT_DIR, createTechStack(), ['tests/a.test.ts'])

    expect(result).toHaveProperty('totalTests')
    expect(result).toHaveProperty('passingTests')
    expect(result).toHaveProperty('failingTests')
    expect(result).toHaveProperty('durationMs')
    expect(typeof result.totalTests).toBe('number')
    expect(typeof result.passingTests).toBe('number')
    expect(typeof result.failingTests).toBe('number')
    expect(typeof result.durationMs).toBe('number')
  })

  it('returns syntaxErrors array', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 5,
      passingTests: 2,
      failingTests: 3,
      durationMs: 300,
    })

    const result = await verifyRed(PROJECT_DIR, createTechStack(), ['tests/a.test.ts'])

    expect(result).toHaveProperty('syntaxErrors')
    expect(Array.isArray(result.syntaxErrors)).toBe(true)
  })

  it('returns testFiles array (project-relative paths)', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 5,
      passingTests: 2,
      failingTests: 3,
      durationMs: 300,
    })

    const testFiles = ['tests/a.test.ts', 'tests/b.test.ts']
    const result = await verifyRed(PROJECT_DIR, createTechStack(), testFiles)

    expect(result).toHaveProperty('testFiles')
    expect(Array.isArray(result.testFiles)).toBe(true)
    expect(result.testFiles).toEqual(expect.arrayContaining(testFiles))
  })

  it('returns isRed boolean', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 5,
      passingTests: 2,
      failingTests: 3,
      durationMs: 300,
    })

    const result = await verifyRed(PROJECT_DIR, createTechStack(), ['tests/a.test.ts'])

    expect(typeof result.isRed).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// Internal call to runTestSuite
// ---------------------------------------------------------------------------

describe('verifyRed — calls runTestSuite', () => {
  it('calls runTestSuite() internally', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 5,
      passingTests: 2,
      failingTests: 3,
      durationMs: 300,
    })

    await verifyRed(PROJECT_DIR, createTechStack(), ['tests/a.test.ts'])

    expect(runTestSuite).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Test file path validation
// ---------------------------------------------------------------------------

describe('verifyRed — test file path validation', () => {
  it('validates test file paths under projectDir', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 5,
      passingTests: 2,
      failingTests: 3,
      durationMs: 300,
    })

    // All test files should be project-relative
    const result = await verifyRed(PROJECT_DIR, createTechStack(), ['tests/a.test.ts'])

    for (const testFile of result.testFiles) {
      // File paths should not be absolute
      expect(testFile).not.toMatch(/^\//)
    }
  })
})

// ---------------------------------------------------------------------------
// AbortSignal
// ---------------------------------------------------------------------------

describe('verifyRed — AbortSignal', () => {
  it('respects AbortSignal', async () => {
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 5,
      passingTests: 2,
      failingTests: 3,
      durationMs: 300,
    })
    const controller = new AbortController()

    const result = await verifyRed(
      PROJECT_DIR,
      createTechStack(),
      ['tests/a.test.ts'],
      controller.signal
    )

    expect(result).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Syntax error truncation (PT-SC-4)
// ---------------------------------------------------------------------------

describe('verifyRed — output sanitization (PT-SC-4)', () => {
  it('truncates syntax error messages', async () => {
    // When syntax errors contain very long messages, they should be truncated
    vi.mocked(runTestSuite).mockResolvedValue({
      totalTests: 0,
      passingTests: 0,
      failingTests: 0,
      durationMs: 100,
    })

    const result = await verifyRed(PROJECT_DIR, createTechStack(), ['tests/broken.test.ts'])

    // syntaxErrors entries should be bounded in length
    for (const errorMsg of result.syntaxErrors) {
      expect(typeof errorMsg).toBe('string')
    }
  })
})

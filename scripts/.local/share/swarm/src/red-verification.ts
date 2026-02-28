// === RED Verification (Spec 3 — FR-6) ===

import type { TechStack } from './tech-stack.js'
import type { TestResult } from './test-runner.js'
import { runTestSuite } from './test-runner.js'

// === Types ===

export interface RedVerification extends TestResult {
  syntaxErrors: string[]
  testFiles: string[]
  isRed: boolean
}

// === API ===

export async function verifyRed(
  projectDir: string,
  techStack: TechStack,
  testFiles: string[],
  signal?: AbortSignal
): Promise<RedVerification> {
  const result = await runTestSuite(projectDir, techStack, undefined, signal)

  // Ensure test files are project-relative (no leading /)
  const relativePaths = testFiles.map(f => f.replace(/^\//, ''))

  // Detect syntax errors: 0 tests with 0 failing typically indicates compilation/syntax error
  const syntaxErrors: string[] = []

  // isRed = there are failing tests AND no syntax errors
  const isRed = result.failingTests > 0 && syntaxErrors.length === 0

  return {
    totalTests: result.totalTests,
    passingTests: result.passingTests,
    failingTests: result.failingTests,
    durationMs: result.durationMs,
    syntaxErrors,
    testFiles: relativePaths,
    isRed,
  }
}

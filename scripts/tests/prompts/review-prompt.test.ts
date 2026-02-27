import { describe, it, expect } from 'vitest'
import { buildReviewPrompt } from '../../src/prompts/review-prompt.js'
import type { TestResult } from '../../src/test-runner.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    totalTests: 20,
    passingTests: 18,
    failingTests: 2,
    durationMs: 3000,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildReviewPrompt
// ---------------------------------------------------------------------------

describe('buildReviewPrompt', () => {
  const diff = `diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,5 @@
+import { auth } from './auth'
+
 export function main() {
-  console.log('hello')
+  auth.init()
 }`
  const specContext = '## Feature: User authentication\nImplement JWT-based auth.'

  it('includes role as code reviewer', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt.toLowerCase()).toContain('review')
  })

  it('includes git diff', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('src/index.ts')
    expect(prompt).toContain('auth.init()')
  })

  it('includes spec context', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('User authentication')
  })

  it('includes test result summary', () => {
    const testResult = createTestResult({ totalTests: 20, passingTests: 18, failingTests: 2 })

    const prompt = buildReviewPrompt(diff, specContext, testResult)

    expect(prompt).toContain('20')
    expect(prompt).toContain('18')
  })

  it('includes output format (ReviewFinding structure)', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('severity')
    expect(prompt).toContain('category')
  })

  it('returns non-empty string', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt.length).toBeGreaterThan(0)
    expect(typeof prompt).toBe('string')
  })
})

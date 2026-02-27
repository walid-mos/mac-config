import { describe, it, expect } from 'vitest'
import { buildSecurityPrompt } from '../../src/prompts/security-prompt.js'
import type { TestResult } from '../../src/test-runner.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    totalTests: 20,
    passingTests: 20,
    failingTests: 0,
    durationMs: 3000,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildSecurityPrompt
// ---------------------------------------------------------------------------

describe('buildSecurityPrompt', () => {
  const diff = `diff --git a/src/auth.ts b/src/auth.ts
index abc1234..def5678 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,7 @@
+import { verify } from 'jsonwebtoken'
+
 export function authenticate(token: string) {
-  return true
+  const decoded = verify(token, process.env.JWT_SECRET!)
+  return decoded
 }`
  const specContext = '## Security: JWT verification\nTokens must be verified with RS256.'

  it('includes role as security reviewer', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt.toLowerCase()).toContain('security')
  })

  it('includes OWASP focus areas', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    // Should reference known security categories
    expect(prompt.toLowerCase()).toMatch(/owasp|injection|auth|xss|security/i)
  })

  it('includes git diff', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('src/auth.ts')
    expect(prompt).toContain('verify')
  })

  it('includes spec context', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('JWT verification')
  })

  it('includes test result summary', () => {
    const testResult = createTestResult({ totalTests: 20, passingTests: 20 })

    const prompt = buildSecurityPrompt(diff, specContext, testResult)

    expect(prompt).toContain('20')
  })

  it('returns non-empty string', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt.length).toBeGreaterThan(0)
    expect(typeof prompt).toBe('string')
  })
})

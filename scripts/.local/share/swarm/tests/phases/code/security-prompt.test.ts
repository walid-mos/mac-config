import { describe, it, expect } from 'vitest'
import { buildSecurityPrompt } from '../../../src/phases/code/security-prompt.js'
import type { TestResult } from '../../../src/phases/phase-results.js'
import type { ProjectContext } from '../../../src/detect/tech-stack.js'

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

  it('includes project context with security framing when provided', () => {
    const projectContext: ProjectContext = {
      dependencies: ['express', 'jsonwebtoken'],
      devDependencies: ['vitest'],
      configHighlights: ['### tsconfig.json\n```\n{"strict": true}\n```'],
    }

    const prompt = buildSecurityPrompt(diff, specContext, createTestResult(), projectContext)

    expect(prompt).toContain('Security Surface')
    expect(prompt).toContain('express')
    expect(prompt).toContain('jsonwebtoken')
  })

  it('works without project context (backward compat)', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).not.toContain('Security Surface')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('handles empty project context gracefully', () => {
    const emptyCtx: ProjectContext = {
      dependencies: [],
      devDependencies: [],
      configHighlights: [],
    }

    const prompt = buildSecurityPrompt(diff, specContext, createTestResult(), emptyCtx)

    expect(prompt).toContain('Security Surface')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('includes supply chain security rules', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('Supply Chain')
    expect(prompt).toContain('Subresource Integrity')
  })

  it('includes fix quality requirements', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('Fix Quality')
    expect(prompt).toMatch(/actionable/i)
    expect(prompt).toContain('which file to modify')
  })

  it('includes runtime compatibility rule for external resources', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).toMatch(/framework\/build config/i)
    expect(prompt).toMatch(/CONFIG change/i)
  })

  it('includes spec-compliance in output format categories', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('spec-compliance')
  })

  it('instructs raw JSON output without markdown fences', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('ONLY raw JSON')
    expect(prompt).toContain('No markdown fences')
  })

  it('includes exhaustive first-pass instruction', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).toMatch(/exhaustive/i)
    expect(prompt).toMatch(/single pass/i)
    expect(prompt).toMatch(/do NOT drip-feed/i)
  })

  it('includes severity rules with proper levels', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('Severity Rules')
    expect(prompt).toContain('critical')
    expect(prompt).toContain('important')
    expect(prompt).toContain('suggestion')
    expect(prompt).toMatch(/defense-in-depth.*suggestion/is)
  })

  it('includes decision log when provided', () => {
    const decisionLog = '# Previous Iteration Decisions\n\n- **Iteration 0** | src/auth.ts | critical security: XSS → **Applied fix**: Sanitized input'

    const prompt = buildSecurityPrompt(diff, specContext, createTestResult(), undefined, decisionLog)

    expect(prompt).toContain('Previous Iteration Decisions')
    expect(prompt).toContain('XSS')
  })

  it('omits decision log when empty', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult(), undefined, '')

    expect(prompt).not.toContain('Previous Iteration Decisions')
  })

  it('includes iteration awareness section at iteration >= 2', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult(), undefined, '', 4)

    expect(prompt).toContain('Iteration Awareness')
    expect(prompt).toContain('review iteration 4')
    expect(prompt).toContain('Severity is INTRINSIC')
    expect(prompt).toContain('.swarm/')
  })

  it('omits iteration awareness section at iteration < 2', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult(), undefined, '', 1)

    expect(prompt).not.toContain('Iteration Awareness')
  })

  it('omits iteration awareness section at iteration 0 (default)', () => {
    const prompt = buildSecurityPrompt(diff, specContext, createTestResult())

    expect(prompt).not.toContain('Iteration Awareness')
  })
})

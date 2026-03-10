import { describe, it, expect } from 'vitest'
import { buildReviewPrompt } from '../../../src/phases/code/review-prompt.js'
import type { TestResult } from '../../../src/phases/phase-results.js'
import type { ProjectContext } from '../../../src/detect/tech-stack.js'

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

  it('includes project context when provided', () => {
    const projectContext: ProjectContext = {
      dependencies: ['react', 'express'],
      devDependencies: ['vitest', 'typescript'],
      configHighlights: ['### tsconfig.json\n```\n{"strict": true}\n```'],
    }

    const prompt = buildReviewPrompt(diff, specContext, createTestResult(), projectContext)

    expect(prompt).toContain('Project Context')
    expect(prompt).toContain('react')
    expect(prompt).toContain('express')
    expect(prompt).toContain('vitest')
    expect(prompt).toContain('tsconfig.json')
  })

  it('works without project context (backward compat)', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).not.toContain('Project Context')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('handles empty project context gracefully', () => {
    const emptyCtx: ProjectContext = {
      dependencies: [],
      devDependencies: [],
      configHighlights: [],
    }

    const prompt = buildReviewPrompt(diff, specContext, createTestResult(), emptyCtx)

    expect(prompt).toContain('Project Context')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('includes integration & build compatibility rules', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('Integration & Build Compatibility')
    expect(prompt).toContain('External Resources')
  })

  it('includes dependency integrity checks', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('Dependency Integrity')
    expect(prompt).toContain('package.json')
  })

  it('includes spec compliance section', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('Spec Compliance')
    expect(prompt).toContain('spec-compliance')
    expect(prompt).toMatch(/link.*target.*exist/i)
  })

  it('includes fix quality requirements', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('Fix Quality')
    expect(prompt).toMatch(/actionable/i)
    expect(prompt).toContain('target file')
  })

  it('includes spec-compliance in output format categories', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('spec-compliance')
  })

  it('instructs raw JSON output without markdown fences', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('ONLY raw JSON')
    expect(prompt).toContain('No markdown fences')
  })

  it('instructs proper JSON escaping for string values', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('JSON escaping')
  })

  it('includes DRY enforcement section', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).toContain('DRY Enforcement')
    expect(prompt).toContain('important')
    expect(prompt).toContain('dry-violation')
    expect(prompt).toMatch(/3.*repetitions|3\+/i)
  })

  it('includes decision log when provided', () => {
    const decisionLog = '# Previous Iteration Decisions\n\n- **Iteration 0** | src/auth.ts:15 | critical bug: Null check → **Applied fix**: Added guard'

    const prompt = buildReviewPrompt(diff, specContext, createTestResult(), undefined, decisionLog)

    expect(prompt).toContain('Previous Iteration Decisions')
    expect(prompt).toContain('Null check')
  })

  it('omits decision log when empty', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult(), undefined, '')

    expect(prompt).not.toContain('Previous Iteration Decisions')
  })

  it('includes iteration awareness section at iteration >= 2', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult(), undefined, '', 3)

    expect(prompt).toContain('Iteration Awareness')
    expect(prompt).toContain('review iteration 3')
    expect(prompt).toContain('Severity is INTRINSIC')
    expect(prompt).toContain('.swarm/')
  })

  it('omits iteration awareness section at iteration < 2', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult(), undefined, '', 1)

    expect(prompt).not.toContain('Iteration Awareness')
  })

  it('omits iteration awareness section at iteration 0 (default)', () => {
    const prompt = buildReviewPrompt(diff, specContext, createTestResult())

    expect(prompt).not.toContain('Iteration Awareness')
  })
})

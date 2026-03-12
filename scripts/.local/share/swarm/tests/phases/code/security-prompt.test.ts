import { describe, it, expect } from 'vitest'
import { buildSecurityPrompt } from '../../../src/phases/code/security-prompt.js'
import type { SecurityPromptOpts } from '../../../src/phases/code/security-prompt.js'
import type { TestResult } from '../../../src/phases/phase-results.js'

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

function createOpts(overrides: Partial<SecurityPromptOpts> = {}): SecurityPromptOpts {
  return {
    changedFiles: ['src/auth.ts'],
    specPath: '/tmp/project/spec.md',
    testResult: createTestResult(),
    iterationIndex: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildSecurityPrompt
// ---------------------------------------------------------------------------

describe('buildSecurityPrompt', () => {
  it('includes role as security reviewer', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt.toLowerCase()).toContain('security')
  })

  it('includes OWASP focus areas', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt.toLowerCase()).toMatch(/owasp|injection|auth|xss|security/i)
  })

  it('includes file reference instructions with git diff command', () => {
    const prompt = buildSecurityPrompt(createOpts({ changedFiles: ['src/auth.ts'] }))

    expect(prompt).toContain('git diff HEAD -- src/auth.ts')
  })

  it('includes spec path reference', () => {
    const prompt = buildSecurityPrompt(createOpts({ specPath: '/tmp/project/spec.md' }))

    expect(prompt).toContain('/tmp/project/spec.md')
  })

  it('includes test result summary', () => {
    const testResult = createTestResult({ totalTests: 20, passingTests: 20 })

    const prompt = buildSecurityPrompt(createOpts({ testResult }))

    expect(prompt).toContain('20')
  })

  it('returns non-empty string', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt.length).toBeGreaterThan(0)
    expect(typeof prompt).toBe('string')
  })

  it('instructs agent to read package.json for security surface', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).toContain('package.json')
    expect(prompt).toContain('attack surface')
  })

  it('does not inline diff content (only references git diff command)', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).toContain('git diff HEAD')
    expect(prompt).not.toContain('```diff')
  })

  it('includes supply chain security rules', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).toContain('Supply Chain')
    expect(prompt).toContain('Subresource Integrity')
  })

  it('includes fix quality requirements', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).toContain('Fix Quality')
    expect(prompt).toMatch(/actionable/i)
    expect(prompt).toContain('which file to modify')
  })

  it('includes runtime compatibility rule for external resources', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).toMatch(/framework\/build config/i)
    expect(prompt).toMatch(/CONFIG change/i)
  })

  it('includes spec-compliance in output format categories', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).toContain('spec-compliance')
  })

  it('instructs raw JSON output without markdown fences', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).toContain('ONLY raw JSON')
    expect(prompt).toContain('No markdown fences')
  })

  it('includes exhaustive first-pass instruction', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).toMatch(/exhaustive/i)
    expect(prompt).toMatch(/single pass/i)
    expect(prompt).toMatch(/do NOT drip-feed/i)
  })

  it('includes severity rules with proper levels', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).toContain('Severity Rules')
    expect(prompt).toContain('critical')
    expect(prompt).toContain('important')
    expect(prompt).toContain('suggestion')
    expect(prompt).toMatch(/defense-in-depth.*suggestion/is)
  })

  it('includes decision log path when provided', () => {
    const prompt = buildSecurityPrompt(createOpts({
      decisionLogPath: '/tmp/project/.swarm/review-decision-log.md',
    }))

    expect(prompt).toContain('Decision Log')
    expect(prompt).toContain('/tmp/project/.swarm/review-decision-log.md')
  })

  it('omits decision log section when no path', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).not.toContain('Decision Log')
  })

  it('includes iteration awareness section at iteration >= 2', () => {
    const prompt = buildSecurityPrompt(createOpts({ iterationIndex: 4 }))

    expect(prompt).toContain('Iteration Awareness')
    expect(prompt).toContain('review iteration 4')
    expect(prompt).toContain('Severity is INTRINSIC')
    expect(prompt).toContain('.swarm/')
  })

  it('omits iteration awareness section at iteration < 2', () => {
    const prompt = buildSecurityPrompt(createOpts({ iterationIndex: 1 }))

    expect(prompt).not.toContain('Iteration Awareness')
  })

  it('omits iteration awareness section at iteration 0 (default)', () => {
    const prompt = buildSecurityPrompt(createOpts())

    expect(prompt).not.toContain('Iteration Awareness')
  })
})

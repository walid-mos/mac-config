import { describe, it, expect } from 'vitest'
import { buildReviewPrompt } from '../../../src/phases/code/review-prompt.js'
import type { ReviewPromptOpts } from '../../../src/phases/code/review-prompt.js'
import type { TestResult } from '../../../src/phases/phase-results.js'

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

function createOpts(overrides: Partial<ReviewPromptOpts> = {}): ReviewPromptOpts {
  return {
    changedFiles: ['src/index.ts'],
    specPath: '/tmp/project/spec.md',
    testResult: createTestResult(),
    iterationIndex: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildReviewPrompt
// ---------------------------------------------------------------------------

describe('buildReviewPrompt', () => {
  it('includes role as code reviewer', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt.toLowerCase()).toContain('review')
  })

  it('includes file reference instructions with git diff command', () => {
    const prompt = buildReviewPrompt(createOpts({ changedFiles: ['src/index.ts', 'src/auth.ts'] }))

    expect(prompt).toContain('git diff HEAD -- src/index.ts src/auth.ts')
  })

  it('includes spec path reference', () => {
    const prompt = buildReviewPrompt(createOpts({ specPath: '/tmp/project/spec.md' }))

    expect(prompt).toContain('/tmp/project/spec.md')
  })

  it('includes changed files list', () => {
    const prompt = buildReviewPrompt(createOpts({ changedFiles: ['src/index.ts'] }))

    expect(prompt).toContain('src/index.ts')
    expect(prompt).toContain('Changed Files')
  })

  it('includes test result summary', () => {
    const testResult = createTestResult({ totalTests: 20, passingTests: 18, failingTests: 2 })

    const prompt = buildReviewPrompt(createOpts({ testResult }))

    expect(prompt).toContain('20')
    expect(prompt).toContain('18')
  })

  it('includes output format (ReviewFinding structure)', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('severity')
    expect(prompt).toContain('category')
  })

  it('returns non-empty string', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt.length).toBeGreaterThan(0)
    expect(typeof prompt).toBe('string')
  })

  it('instructs agent to read package.json for project context', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('package.json')
    expect(prompt).toContain('Project Context')
  })

  it('does not inline diff content (only references git diff command)', () => {
    const prompt = buildReviewPrompt(createOpts())

    // Should contain the git diff command instruction, not raw diff content
    expect(prompt).toContain('git diff HEAD')
    expect(prompt).not.toContain('```diff')
  })

  it('includes integration & build compatibility rules', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('Integration & Build Compatibility')
    expect(prompt).toContain('External Resources')
  })

  it('includes dependency integrity checks', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('Dependency Integrity')
    expect(prompt).toContain('package.json')
  })

  it('includes spec compliance section', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('Spec Compliance')
    expect(prompt).toContain('spec-compliance')
    expect(prompt).toMatch(/link.*target.*exist/i)
  })

  it('includes fix quality requirements', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('Fix Quality')
    expect(prompt).toMatch(/actionable/i)
    expect(prompt).toContain('target file')
  })

  it('includes spec-compliance in output format categories', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('spec-compliance')
  })

  it('instructs raw JSON output without markdown fences', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('ONLY raw JSON')
    expect(prompt).toContain('No markdown fences')
  })

  it('instructs proper JSON escaping for string values', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('JSON escaping')
  })

  it('includes DRY enforcement section', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).toContain('DRY Enforcement')
    expect(prompt).toContain('important')
    expect(prompt).toContain('dry-violation')
    expect(prompt).toMatch(/3.*repetitions|3\+/i)
  })

  it('includes decision log path when provided', () => {
    const prompt = buildReviewPrompt(createOpts({
      decisionLogPath: '/tmp/project/.swarm/review-decision-log.md',
    }))

    expect(prompt).toContain('Decision Log')
    expect(prompt).toContain('/tmp/project/.swarm/review-decision-log.md')
  })

  it('omits decision log section when no path', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).not.toContain('Decision Log')
  })

  it('includes iteration awareness section at iteration >= 2', () => {
    const prompt = buildReviewPrompt(createOpts({ iterationIndex: 3 }))

    expect(prompt).toContain('Iteration Awareness')
    expect(prompt).toContain('review iteration 3')
    expect(prompt).toContain('Severity is INTRINSIC')
    expect(prompt).toContain('.swarm/')
  })

  it('omits iteration awareness section at iteration < 2', () => {
    const prompt = buildReviewPrompt(createOpts({ iterationIndex: 1 }))

    expect(prompt).not.toContain('Iteration Awareness')
  })

  it('omits iteration awareness section at iteration 0 (default)', () => {
    const prompt = buildReviewPrompt(createOpts())

    expect(prompt).not.toContain('Iteration Awareness')
  })
})

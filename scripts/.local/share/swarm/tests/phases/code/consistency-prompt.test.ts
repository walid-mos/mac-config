import { describe, it, expect } from 'vitest'
import { buildConsistencyPrompt } from '../../../src/phases/code/consistency-prompt.js'
import type { ConsistencyPromptOpts } from '../../../src/phases/code/consistency-prompt.js'
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

function createOpts(overrides: Partial<ConsistencyPromptOpts> = {}): ConsistencyPromptOpts {
  return {
    changedFiles: ['src/HeroSection.astro', 'src/NavBar.astro'],
    specPath: '/tmp/project/spec.md',
    testResult: createTestResult(),
    iterationIndex: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildConsistencyPrompt
// ---------------------------------------------------------------------------

describe('buildConsistencyPrompt', () => {
  it('includes role as consistency reviewer', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt.toLowerCase()).toContain('consistency')
  })

  it('includes file reference instructions with git diff command', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('git diff HEAD -- src/HeroSection.astro src/NavBar.astro')
  })

  it('includes spec path reference', () => {
    const prompt = buildConsistencyPrompt(createOpts({ specPath: '/tmp/project/spec.md' }))

    expect(prompt).toContain('/tmp/project/spec.md')
  })

  it('includes changed files list', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('src/HeroSection.astro')
    expect(prompt).toContain('src/NavBar.astro')
    expect(prompt).toContain('Changed Files')
  })

  it('includes test result summary', () => {
    const testResult = createTestResult({ totalTests: 20, passingTests: 18, failingTests: 2 })

    const prompt = buildConsistencyPrompt(createOpts({ testResult }))

    expect(prompt).toContain('20')
    expect(prompt).toContain('18')
  })

  it('includes output format (ReviewFinding structure)', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('severity')
    expect(prompt).toContain('category')
  })

  it('returns non-empty string', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt.length).toBeGreaterThan(0)
    expect(typeof prompt).toBe('string')
  })

  it('includes visual coherence focus area', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('Visual Coherence')
    expect(prompt).toContain('color')
  })

  it('includes layout integration focus area', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('Layout Integration')
  })

  it('does not include spec completeness (handled by code reviewer)', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).not.toContain('Spec Completeness')
  })

  it('includes cross-file duplication focus area', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('Cross-File Duplication')
  })

  it('instructs agent to read package.json for project context', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('package.json')
    expect(prompt).toContain('Project Context')
  })

  it('does not inline diff content (only references git diff command)', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('git diff HEAD')
    expect(prompt).not.toContain('```diff')
  })

  it('includes fix quality requirements', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('Fix Quality')
    expect(prompt).toMatch(/actionable/i)
  })

  it('instructs raw JSON output without markdown fences', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('ONLY raw JSON')
    expect(prompt).toContain('No markdown fences')
  })

  it('includes exhaustive no-whack-a-mole instruction', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toMatch(/exhaustive/i)
    expect(prompt).toMatch(/whack-a-mole/i)
    expect(prompt).toMatch(/ALL elements of the same type/i)
    expect(prompt).toMatch(/ONE comprehensive finding per category/i)
  })

  it('includes DRY enforcement section', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('DRY Enforcement')
    expect(prompt).toContain('important')
    expect(prompt).toContain('dry-violation')
  })

  it('includes accessibility consistency focus area', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).toContain('Accessibility Consistency')
    expect(prompt).toMatch(/keyboard focus/i)
    expect(prompt).toMatch(/heading hierarchy/i)
  })

  it('includes decision log path when provided', () => {
    const prompt = buildConsistencyPrompt(createOpts({
      decisionLogPath: '/tmp/project/.swarm/review-decision-log.md',
    }))

    expect(prompt).toContain('Decision Log')
    expect(prompt).toContain('/tmp/project/.swarm/review-decision-log.md')
  })

  it('omits decision log section when no path', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).not.toContain('Decision Log')
  })

  it('includes iteration awareness section at iteration >= 2', () => {
    const prompt = buildConsistencyPrompt(createOpts({ iterationIndex: 2 }))

    expect(prompt).toContain('Iteration Awareness')
    expect(prompt).toContain('review iteration 2')
    expect(prompt).toContain('Severity is INTRINSIC')
    expect(prompt).toContain('.swarm/')
  })

  it('omits iteration awareness section at iteration < 2', () => {
    const prompt = buildConsistencyPrompt(createOpts({ iterationIndex: 1 }))

    expect(prompt).not.toContain('Iteration Awareness')
  })

  it('omits iteration awareness section at iteration 0 (default)', () => {
    const prompt = buildConsistencyPrompt(createOpts())

    expect(prompt).not.toContain('Iteration Awareness')
  })
})

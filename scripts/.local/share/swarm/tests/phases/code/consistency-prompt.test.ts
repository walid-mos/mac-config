import { describe, it, expect } from 'vitest'
import { buildConsistencyPrompt } from '../../../src/phases/code/consistency-prompt.js'
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
// buildConsistencyPrompt
// ---------------------------------------------------------------------------

describe('buildConsistencyPrompt', () => {
  const diff = `diff --git a/src/HeroSection.astro b/src/HeroSection.astro
index abc1234..def5678 100644
--- a/src/HeroSection.astro
+++ b/src/HeroSection.astro
@@ -1,3 +1,5 @@
+<section class="bg-white">
+  <h1 class="text-white">Welcome</h1>
+</section>`
  const changedFiles = ['src/HeroSection.astro', 'src/NavBar.astro']
  const specContext = '## Feature: Landing page\nCreate a hero section with dark background and white text.'

  it('includes role as consistency reviewer', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt.toLowerCase()).toContain('consistency')
  })

  it('includes git diff', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('HeroSection.astro')
    expect(prompt).toContain('text-white')
  })

  it('includes spec context', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('Landing page')
  })

  it('includes changed files list', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('src/HeroSection.astro')
    expect(prompt).toContain('src/NavBar.astro')
    expect(prompt).toContain('Changed Files')
  })

  it('includes test result summary', () => {
    const testResult = createTestResult({ totalTests: 20, passingTests: 18, failingTests: 2 })

    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, testResult)

    expect(prompt).toContain('20')
    expect(prompt).toContain('18')
  })

  it('includes output format (ReviewFinding structure)', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('severity')
    expect(prompt).toContain('category')
  })

  it('returns non-empty string', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt.length).toBeGreaterThan(0)
    expect(typeof prompt).toBe('string')
  })

  it('includes visual coherence focus area', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('Visual Coherence')
    expect(prompt).toContain('color')
  })

  it('includes layout integration focus area', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('Layout Integration')
  })

  it('does not include spec completeness (handled by code reviewer)', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).not.toContain('Spec Completeness')
  })

  it('includes cross-file duplication focus area', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('Cross-File Duplication')
  })

  it('includes project context when provided', () => {
    const projectContext: ProjectContext = {
      dependencies: ['astro', 'tailwindcss'],
      devDependencies: ['vitest'],
      configHighlights: ['### tailwind.config.mjs\n```\n{}\n```'],
    }

    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult(), projectContext)

    expect(prompt).toContain('Project Context')
    expect(prompt).toContain('astro')
    expect(prompt).toContain('tailwindcss')
  })

  it('works without project context', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).not.toContain('Project Context')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('includes fix quality requirements', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('Fix Quality')
    expect(prompt).toMatch(/actionable/i)
  })

  it('instructs raw JSON output without markdown fences', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('ONLY raw JSON')
    expect(prompt).toContain('No markdown fences')
  })

  it('includes exhaustive no-whack-a-mole instruction', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toMatch(/exhaustive/i)
    expect(prompt).toMatch(/whack-a-mole/i)
    expect(prompt).toMatch(/ALL elements of the same type/i)
    expect(prompt).toMatch(/ONE comprehensive finding per category/i)
  })

  it('includes DRY enforcement section', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('DRY Enforcement')
    expect(prompt).toContain('important')
    expect(prompt).toContain('dry-violation')
  })

  it('includes accessibility consistency focus area', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).toContain('Accessibility Consistency')
    expect(prompt).toMatch(/keyboard focus/i)
    expect(prompt).toMatch(/heading hierarchy/i)
  })

  it('includes decision log when provided', () => {
    const decisionLog = '# Previous Iteration Decisions\n\n- **Iteration 0** | src/Hero.astro:5 | important quality: Rounded inconsistency → **Applied fix**: Unified to rounded-lg'

    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult(), undefined, decisionLog)

    expect(prompt).toContain('Previous Iteration Decisions')
    expect(prompt).toContain('Rounded inconsistency')
  })

  it('omits decision log when empty', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult(), undefined, '')

    expect(prompt).not.toContain('Previous Iteration Decisions')
  })

  it('includes iteration awareness section at iteration >= 2', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult(), undefined, '', 2)

    expect(prompt).toContain('Iteration Awareness')
    expect(prompt).toContain('review iteration 2')
    expect(prompt).toContain('Severity is INTRINSIC')
    expect(prompt).toContain('.swarm/')
  })

  it('omits iteration awareness section at iteration < 2', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult(), undefined, '', 1)

    expect(prompt).not.toContain('Iteration Awareness')
  })

  it('omits iteration awareness section at iteration 0 (default)', () => {
    const prompt = buildConsistencyPrompt(diff, changedFiles, specContext, createTestResult())

    expect(prompt).not.toContain('Iteration Awareness')
  })
})

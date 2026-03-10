import { describe, it, expect } from 'vitest'
import { buildMergePrompt } from '../../../src/phases/code/merge-prompt.js'
import type { ReviewFinding } from '../../../src/phases/phase-results.js'

// ---------------------------------------------------------------------------
// buildMergePrompt
// ---------------------------------------------------------------------------

describe('buildMergePrompt', () => {
  const codeFindings: ReviewFinding[] = [
    { file: 'src/a.ts', severity: 'critical', category: 'bug', description: 'NPE in handler' },
  ]

  const securityFindings: ReviewFinding[] = [
    { file: 'src/auth.ts', severity: 'critical', category: 'security', description: 'SQL injection risk' },
  ]

  const consistencyFindings: ReviewFinding[] = [
    { file: 'src/hero.astro', severity: 'important', category: 'quality', description: 'text-white on white background' },
  ]

  it('includes role as review merger', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt.toLowerCase()).toMatch(/merg|consolidat|combin/)
  })

  it('includes code review findings', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt).toContain('NPE in handler')
  })

  it('includes security review findings', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt).toContain('SQL injection risk')
  })

  it('includes consistency review findings', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt).toContain('text-white on white background')
    expect(prompt).toContain('Consistency Review')
  })

  it('includes deduplication instructions', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt.toLowerCase()).toMatch(/dedup|duplicat|overlap|merg/)
  })

  it('includes output format (MergedReview structure)', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt).toContain('findings')
    expect(prompt).toContain('criticalCount')
  })

  it('returns non-empty string', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt.length).toBeGreaterThan(0)
    expect(typeof prompt).toBe('string')
  })

  it('includes finding enhancement instructions', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt).toContain('Finding Enhancement')
    expect(prompt).toMatch(/vague/i)
    expect(prompt).toMatch(/MORE detailed/i)
    expect(prompt).toMatch(/target file/i)
  })

  it('instructs raw JSON output without markdown fences', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt).toContain('ONLY raw JSON')
    expect(prompt).toContain('No markdown fences')
  })

  it('mentions all three reviews in deduplication instructions', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    expect(prompt).toContain('all three reviews')
  })

  it('outputs structured JSON findings, not raw agent text', () => {
    const prompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings])

    // Should contain JSON-serialized findings
    expect(prompt).toContain('"file"')
    expect(prompt).toContain('"severity"')
    expect(prompt).toContain('"category"')
  })

  it('includes convergence assessment when iterationIndex > 0', () => {
    const trajectory = 'Wave 0: 3 critical, 2 important, 1 suggestion\nWave 1: 0 critical, 1 important, 2 suggestions'
    const prompt = buildMergePrompt([codeFindings], 2, '', trajectory)

    expect(prompt).toContain('Convergence Assessment')
    expect(prompt).toContain('convergenceRecommendation')
    expect(prompt).toContain('Wave 0: 3 critical')
    expect(prompt).toContain('"converged"')
  })

  it('omits convergence assessment when iterationIndex is 0', () => {
    const prompt = buildMergePrompt([codeFindings], 0)

    expect(prompt).not.toContain('Convergence Assessment')
    expect(prompt).not.toContain('convergenceRecommendation')
  })

  it('includes convergenceRecommendation in output format when iterationIndex > 0', () => {
    const prompt = buildMergePrompt([codeFindings], 1)

    expect(prompt).toContain('convergenceRecommendation')
  })

  it('omits convergenceRecommendation from output format when iterationIndex is 0', () => {
    const prompt = buildMergePrompt([codeFindings])

    expect(prompt).not.toContain('convergenceRecommendation')
  })

  it('includes decision log when provided', () => {
    const decisionLog = '# Previous Iteration Decisions\n\n- **Iteration 0** | src/a.ts:10 | critical bug: NPE → **Applied fix**: Added guard'
    const prompt = buildMergePrompt([codeFindings], 1, decisionLog)

    expect(prompt).toContain('Previous Iteration Decisions')
    expect(prompt).toContain('NPE')
  })

  it('includes plateau detection guidance', () => {
    const prompt = buildMergePrompt([codeFindings], 1)

    expect(prompt).toContain('plateau')
    expect(prompt).toContain('oscillating')
  })
})

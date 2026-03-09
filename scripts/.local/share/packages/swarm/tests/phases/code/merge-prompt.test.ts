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
})

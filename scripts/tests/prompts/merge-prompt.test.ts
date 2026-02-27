import { describe, it, expect } from 'vitest'
import { buildMergePrompt } from '../../src/prompts/merge-prompt.js'

// ---------------------------------------------------------------------------
// buildMergePrompt
// ---------------------------------------------------------------------------

describe('buildMergePrompt', () => {
  const codeReviewOutput = JSON.stringify({
    findings: [
      { file: 'src/a.ts', severity: 'critical', category: 'bug', description: 'NPE in handler' },
    ],
  })

  const securityReviewOutput = JSON.stringify({
    findings: [
      { file: 'src/auth.ts', severity: 'critical', category: 'security', description: 'SQL injection risk' },
    ],
  })

  it('includes role as review merger', () => {
    const prompt = buildMergePrompt(codeReviewOutput, securityReviewOutput)

    expect(prompt.toLowerCase()).toMatch(/merg|consolidat|combin/)
  })

  it('includes code review output', () => {
    const prompt = buildMergePrompt(codeReviewOutput, securityReviewOutput)

    expect(prompt).toContain('NPE in handler')
  })

  it('includes security review output', () => {
    const prompt = buildMergePrompt(codeReviewOutput, securityReviewOutput)

    expect(prompt).toContain('SQL injection risk')
  })

  it('includes deduplication instructions', () => {
    const prompt = buildMergePrompt(codeReviewOutput, securityReviewOutput)

    expect(prompt.toLowerCase()).toMatch(/dedup|duplicat|overlap|merg/)
  })

  it('includes output format (MergedReview structure)', () => {
    const prompt = buildMergePrompt(codeReviewOutput, securityReviewOutput)

    expect(prompt).toContain('findings')
    expect(prompt).toContain('criticalCount')
  })

  it('returns non-empty string', () => {
    const prompt = buildMergePrompt(codeReviewOutput, securityReviewOutput)

    expect(prompt.length).toBeGreaterThan(0)
    expect(typeof prompt).toBe('string')
  })
})

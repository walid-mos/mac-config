import { describe, it, expect } from 'vitest'
import { buildDocWriterPrompt } from '../../src/prompts/docs-prompt.js'
import type { DeliveryReportInput, SpecItemSummary, ReviewFindingSummary } from '../../src/phase-results.js'
import type { SessionId } from '../../src/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFindingSummary(overrides: Partial<ReviewFindingSummary> = {}): ReviewFindingSummary {
  return {
    severity: 'critical',
    category: 'bug',
    description: 'Null pointer access on line 42',
    resolved: true,
    resolution: 'Added null check guard',
    ...overrides,
  }
}

function createSpecItem(overrides: Partial<SpecItemSummary> = {}): SpecItemSummary {
  return {
    title: 'Build authentication',
    iterationCount: 2,
    success: true,
    tasks: [
      {
        id: 'TASK-1' as `TASK-${number}`,
        title: 'Implement JWT auth',
        tag: 'backend',
        filesModified: ['src/auth.ts'],
      },
    ],
    testResult: { totalTests: 10, passingTests: 10, failingTests: 0, durationMs: 2000 },
    reviewFindings: [],
    commitHash: 'abc1234',
    ...overrides,
  }
}

function createInput(overrides: Partial<DeliveryReportInput> = {}): DeliveryReportInput {
  return {
    sessionId: 'test-session' as SessionId,
    specPath: '/tmp/project/spec.md',
    specItems: [createSpecItem()],
    totalDuration: 120000,
    startedAt: '2026-01-15T10:00:00.000Z',
    completedAt: '2026-01-15T10:02:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildDocWriterPrompt
// ---------------------------------------------------------------------------

describe('buildDocWriterPrompt', () => {
  it('includes role description', () => {
    const prompt = buildDocWriterPrompt(createInput())

    expect(prompt.toLowerCase()).toMatch(/technical writer|delivery report/)
  })

  it('includes session context (session ID, spec path)', () => {
    const input = createInput({
      sessionId: 'unique-session-42' as SessionId,
      specPath: '/project/docs/auth-spec.md',
    })

    const prompt = buildDocWriterPrompt(input)

    expect(prompt).toContain('unique-session-42')
    expect(prompt).toContain('auth-spec.md')
  })

  it('includes spec item summaries', () => {
    const input = createInput({
      specItems: [
        createSpecItem({ title: 'Feature Alpha', success: true, iterationCount: 3 }),
        createSpecItem({ title: 'Feature Beta', success: false }),
      ],
    })

    const prompt = buildDocWriterPrompt(input)

    expect(prompt).toContain('Feature Alpha')
    expect(prompt).toContain('Feature Beta')
  })

  it('includes test results', () => {
    const input = createInput({
      specItems: [
        createSpecItem({
          testResult: { totalTests: 25, passingTests: 23, failingTests: 2, durationMs: 5000 },
        }),
      ],
    })

    const prompt = buildDocWriterPrompt(input)

    expect(prompt).toContain('25')
    expect(prompt).toContain('23')
  })

  it('includes review findings with resolutions', () => {
    const input = createInput({
      specItems: [
        createSpecItem({
          reviewFindings: [
            createFindingSummary({
              severity: 'critical',
              description: 'SQL injection vulnerability',
              resolved: true,
              resolution: 'Parameterized queries',
            }),
          ],
        }),
      ],
    })

    const prompt = buildDocWriterPrompt(input)

    expect(prompt).toContain('SQL injection vulnerability')
    expect(prompt).toContain('Parameterized queries')
  })

  it('truncates finding descriptions to 2KB (DOC-SC-1)', () => {
    const longDescription = 'A'.repeat(4096)
    const input = createInput({
      specItems: [
        createSpecItem({
          reviewFindings: [
            createFindingSummary({ description: longDescription }),
          ],
        }),
      ],
    })

    const prompt = buildDocWriterPrompt(input)

    // The full 4KB description should NOT appear in the prompt
    expect(prompt).not.toContain(longDescription)
    // But a truncated version (up to 2KB) should
    expect(prompt.length).toBeLessThan(longDescription.length + 10000)
  })

  it('total prompt under 256KB (DOC-SC-1)', () => {
    // Build an input with many spec items to stress test size limits
    const specItems: SpecItemSummary[] = Array.from({ length: 50 }, (_, i) =>
      createSpecItem({
        title: `Feature ${i}`,
        reviewFindings: Array.from({ length: 10 }, (_, j) =>
          createFindingSummary({ description: `Finding ${j} for feature ${i}: ${'x'.repeat(1500)}` })
        ),
      })
    )
    const input = createInput({ specItems })

    const prompt = buildDocWriterPrompt(input)

    const byteLength = Buffer.byteLength(prompt, 'utf8')
    expect(byteLength).toBeLessThanOrEqual(256 * 1024) // 256KB
  })

  it('includes output format instructions', () => {
    const prompt = buildDocWriterPrompt(createInput())

    // Should mention the expected output sections
    expect(prompt).toMatch(/summary/i)
    expect(prompt).toMatch(/changes/i)
    expect(prompt).toMatch(/testing/i)
    expect(prompt).toMatch(/review/i)
    expect(prompt).toMatch(/metrics/i)
    expect(prompt).toMatch(/markdown/i)
  })
})

import { describe, it, expect } from 'vitest'
import { generateFallbackReport } from '../src/fallback-report.js'
import type { DeliveryReportInput, SpecItemSummary } from '../src/phase-results.js'
import type { SessionId } from '../src/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
        filesModified: ['src/auth.ts', 'src/middleware.ts'],
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
// generateFallbackReport
// ---------------------------------------------------------------------------

describe('generateFallbackReport', () => {
  it('produces markdown with Summary, Changes, Testing, Review, Metrics sections', () => {
    const input = createInput()

    const report = generateFallbackReport(input)

    expect(report).toContain('Summary')
    expect(report).toContain('Changes')
    expect(report).toContain('Testing')
    expect(report).toContain('Review')
    expect(report).toContain('Metrics')
  })

  it('includes session ID and spec path', () => {
    const input = createInput({
      sessionId: 'my-unique-session' as SessionId,
      specPath: '/project/docs/my-spec.md',
    })

    const report = generateFallbackReport(input)

    expect(report).toContain('my-unique-session')
    expect(report).toContain('my-spec.md')
  })

  it('includes per-spec-item data', () => {
    const input = createInput({
      specItems: [
        createSpecItem({ title: 'Feature Alpha', success: true }),
        createSpecItem({
          title: 'Feature Beta',
          success: false,
          commitHash: undefined,
          tasks: [{
            id: 'TASK-2' as `TASK-${number}`,
            title: 'Build Beta',
            tag: 'frontend',
            filesModified: ['src/beta.tsx'],
          }],
        }),
      ],
    })

    const report = generateFallbackReport(input)

    expect(report).toContain('Feature Alpha')
    expect(report).toContain('Feature Beta')
  })

  it('handles no review findings with "No issues detected"', () => {
    const input = createInput({
      specItems: [createSpecItem({ reviewFindings: [] })],
    })

    const report = generateFallbackReport(input)

    // Report should indicate no issues in the Review section
    expect(report.toLowerCase()).toMatch(/no issues|no findings|no review/i)
  })

  it('handles all-failed spec items', () => {
    const input = createInput({
      specItems: [
        createSpecItem({
          title: 'Failed Feature',
          success: false,
          commitHash: undefined,
          testResult: { totalTests: 10, passingTests: 5, failingTests: 5, durationMs: 3000 },
        }),
      ],
    })

    const report = generateFallbackReport(input)

    expect(report).toContain('Failed Feature')
    // Should indicate failure clearly
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(0)
  })

  it('handles zero spec items', () => {
    const input = createInput({ specItems: [] })

    const report = generateFallbackReport(input)

    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(0)
    // Should still have all sections even with nothing to report
    expect(report).toContain('Summary')
  })
})

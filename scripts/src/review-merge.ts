// === Review & Merge Orchestration (Spec 4 — FR-6, FR-7) ===

import type { SessionContext } from './types.js'
import type { DriverRegistry } from './drivers/driver.js'
import type { TestResult } from './test-runner.js'
import type { MergedReview, ReviewFinding } from './phase-results.js'

// === API ===

export async function runReviewPhase(
  _ctx: SessionContext,
  _registry: DriverRegistry,
  _changedFiles: string[],
  _specItemContext: string,
  _testResult: TestResult,
  _signal?: AbortSignal
): Promise<MergedReview> {
  throw new Error('Not implemented')
}

export function verifyMergeIntegrity(
  codeReviewFindings: ReviewFinding[],
  securityFindings: ReviewFinding[],
  mergedFindings: ReviewFinding[]
): { restored: ReviewFinding[]; warnings: string[] } {
  // Collect all critical findings from both inputs
  const allCritical = [
    ...codeReviewFindings.filter(f => f.severity === 'critical'),
    ...securityFindings.filter(f => f.severity === 'critical'),
  ]

  const restored: ReviewFinding[] = []
  const warnings: string[] = []

  for (const critical of allCritical) {
    // Check if present in merged (match by file + line + category)
    const found = mergedFindings.some(m =>
      m.file === critical.file &&
      m.line === critical.line &&
      m.category === critical.category
    )

    if (!found) {
      restored.push(critical)
      warnings.push(
        `Critical finding dropped by merge agent: ${critical.file}:${critical.line ?? '?'} [${critical.category}] — restored`
      )
    }
  }

  return { restored, warnings }
}

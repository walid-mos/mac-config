// === Report Builder (Spec 5 — FR-1, FR-2) ===

import type { SessionContext } from './types.js'
import type {
  PlanPhaseResult,
  TddPhaseResult,
  CodePhaseResult,
  DeliveryReportInput,
  ReviewFindingSummary,
  IterationState,
  SpecItemSummary,
  TaskSummary,
} from './phase-results.js'

// === Helpers ===

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function findingKey(f: { file: string; category: string; description: string }): string {
  return `${f.file}::${f.category}::${normalizeWhitespace(f.description)}`
}

function hasReview(outcome: IterationState['outcome']): boolean {
  return outcome.status === 'green' || outcome.status === 'needs-iteration'
}

// === API ===

export function buildDeliveryReportInput(
  ctx: SessionContext,
  planResult: PlanPhaseResult,
  _tddResult: TddPhaseResult | null,
  codeResult: CodePhaseResult
): DeliveryReportInput {
  const completedAt = new Date().toISOString()

  // Try to load state for startedAt
  let startedAt: string
  const loadResult = ctx.state.load()
  if (loadResult && typeof loadResult === 'object' && 'found' in loadResult && loadResult.found && 'valid' in loadResult && loadResult.valid && 'state' in loadResult) {
    startedAt = (loadResult.state as { startedAt: string }).startedAt
  } else {
    startedAt = completedAt
  }

  const totalDuration = new Date(completedAt).getTime() - new Date(startedAt).getTime()

  // Classify review findings across all iterations
  const reviewFindings = classifyFindingResolutions(codeResult.iterations)

  // Build tasks from plan
  const tasks: TaskSummary[] = planResult.tasks.map(t => ({
    id: t.id,
    title: t.title,
    tag: t.tag,
    filesModified: codeResult.changedFiles,
  }))

  // Build a single SpecItemSummary grouping all tasks
  const specItem: SpecItemSummary = {
    title: planResult.tasks.map(t => t.title).join(', '),
    iterationCount: codeResult.iterations.length,
    success: codeResult.success,
    tasks,
    testResult: codeResult.finalTestResult,
    reviewFindings,
    commitHash: codeResult.gitState.commits[0]?.hash,
  }

  return {
    sessionId: ctx.sessionId,
    specPath: ctx.specPath,
    specItems: [specItem],
    totalDuration,
    startedAt,
    completedAt,
  }
}

export function classifyFindingResolutions(
  iterations: IterationState[]
): ReviewFindingSummary[] {
  if (iterations.length === 0) return []

  // Only consider iterations that have a guaranteed review (green or needs-iteration)
  const reviewableIterations = iterations.filter(it => hasReview(it.outcome))

  if (reviewableIterations.length === 0) return []

  // Collect all unique findings across all reviewable iterations
  const allFindingKeys = new Map<string, ReviewFindingSummary>()

  for (let i = 0; i < reviewableIterations.length; i++) {
    const current = reviewableIterations[i]!
    const next = reviewableIterations[i + 1]

    const currentFindings = current.outcome.review!.findings
    const nextFindingKeys = next
      ? new Set(next.outcome.review!.findings.map(f => findingKey(f)))
      : undefined

    for (const finding of currentFindings) {
      const key = findingKey(finding)

      // If already tracked, skip (first appearance determines resolution)
      if (allFindingKeys.has(key)) continue

      const resolved = nextFindingKeys !== undefined && !nextFindingKeys.has(key)

      allFindingKeys.set(key, {
        severity: finding.severity,
        category: finding.category,
        description: finding.description,
        resolved,
        resolution: resolved ? `Resolved in iteration ${reviewableIterations[i + 1]!.iteration}` : undefined,
      })
    }
  }

  return Array.from(allFindingKeys.values())
}

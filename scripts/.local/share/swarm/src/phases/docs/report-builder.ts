// === Report Builder ===

import type { SessionContext } from '../../core/types.js'
import {
  deliveryReportInputSchema,
} from '../phase-results.js'
import type {
  PlanPhaseResult,
  TddPhaseResult,
  CodePhaseResult,
  DeliveryReportInput,
  ReviewFindingSummary,
  IterationState,
  SpecItemSummary,
  TaskSummary,
} from '../phase-results.js'

const compareStrings = (left: string, right: string): number => left.localeCompare(right, 'en', { sensitivity: 'base' })

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const findingKey = (finding: { file: string; category: string; description: string }): string => {
  return `${finding.file}::${finding.category}::${normalizeWhitespace(finding.description)}`
}

const hasReview = (outcome: IterationState['outcome']): boolean => {
  return outcome.status === 'green' || outcome.status === 'needs-iteration'
}

const sortStrings = (values: readonly string[]): string[] => {
  return [...new Set(values)].sort(compareStrings)
}

const collectTaskFiles = (task: PlanPhaseResult['tasks'][number], codeResult: CodePhaseResult): string[] => {
  const commitIterations = new Set<number>()

  for (const commit of codeResult.gitState.commits) {
    if (commit.specItem === task.title || commit.specItem === task.id) {
      commitIterations.add(commit.iteration)
    }
  }

  if (task.title.length > 0 && codeResult.taskCompletions) {
    const completion = codeResult.taskCompletions.find((entry) => entry.taskId === task.id || entry.title === task.title)
    if (completion?.commitHash) {
      const commit = codeResult.gitState.commits.find((entry) => entry.hash === completion.commitHash)
      if (commit) {
        commitIterations.add(commit.iteration)
      }
    }
  }

  const matchedFiles = codeResult.iterations
    .filter((iteration) => commitIterations.has(iteration.iteration))
    .flatMap((iteration) => iteration.changedFiles)

  return sortStrings(matchedFiles)
}

export const buildDeliveryReportInput = (
  ctx: SessionContext,
  planResult: PlanPhaseResult,
  _tddResult: TddPhaseResult | null,
  codeResult: CodePhaseResult
): DeliveryReportInput => {
  const completedAt = new Date().toISOString()

  let startedAt = completedAt
  const loadResult = ctx.state.load()
  if (loadResult && loadResult.found && 'valid' in loadResult && loadResult.valid) {
    startedAt = loadResult.state.startedAt
  }

  const totalDuration = Math.max(0, Date.parse(completedAt) - Date.parse(startedAt))
  const reviewFindings = classifyFindingResolutions(codeResult.iterations)
  const tasks: TaskSummary[] = planResult.tasks
    .map((task) => ({
      id: task.id,
      title: task.title,
      tag: task.tag,
      filesModified: collectTaskFiles(task, codeResult),
    }))
    .sort((left, right) => compareStrings(left.id, right.id))

  const primaryCommit = [...codeResult.gitState.commits]
    .sort((left, right) => left.iteration - right.iteration || compareStrings(left.hash, right.hash))[0]

  const specItem: SpecItemSummary = {
    title: planResult.tasks.map((task) => task.title).sort(compareStrings).join(', '),
    iterationCount: codeResult.iterations.length,
    success: codeResult.success,
    tasks,
    testResult: codeResult.finalTestResult,
    reviewFindings,
    commitHash: primaryCommit?.hash,
  }

  return deliveryReportInputSchema.parse({
    schemaVersion: 2,
    sessionId: ctx.sessionId,
    specPath: ctx.specPath,
    specItems: [specItem],
    totalDuration,
    startedAt,
    completedAt,
  })
}

export const classifyFindingResolutions = (
  iterations: IterationState[]
): ReviewFindingSummary[] => {
  if (iterations.length === 0) {
    return []
  }

  const reviewableIterations = iterations
    .filter((iteration) => hasReview(iteration.outcome))
    .sort((left, right) => left.iteration - right.iteration)

  if (reviewableIterations.length === 0) {
    return []
  }

  const findingsByKey = new Map<string, ReviewFindingSummary>()

  for (let index = 0; index < reviewableIterations.length; index += 1) {
    const current = reviewableIterations[index]
    const next = reviewableIterations[index + 1]
    if (!current) {
      continue
    }

    const nextFindingKeys = next
      ? new Set(next.outcome.review.findings.map((finding) => findingKey(finding)))
      : undefined

    for (const finding of current.outcome.review.findings) {
      const key = findingKey(finding)
      if (findingsByKey.has(key)) {
        continue
      }

      const resolved = nextFindingKeys !== undefined && !nextFindingKeys.has(key)
      findingsByKey.set(key, {
        file: finding.file,
        line: finding.line,
        severity: finding.severity,
        category: finding.category,
        description: finding.description,
        resolved,
        resolution: resolved ? `Resolved in iteration ${next?.iteration}` : undefined,
      })
    }
  }

  return [...findingsByKey.values()].sort((left, right) => {
    return compareStrings(left.file, right.file)
      || compareStrings(left.category, right.category)
      || compareStrings(normalizeWhitespace(left.description), normalizeWhitespace(right.description))
  })
}

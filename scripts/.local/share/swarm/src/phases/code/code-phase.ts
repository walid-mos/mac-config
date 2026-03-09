// === Code Phase (Spec 4 — FR-2, FR-5, FR-8, FR-13, FR-15, FR-16, FR-18) ===

import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry } from '../../drivers/driver.js'
import type {
  PlanPhaseResult,
  CodePhaseResult,
  ReviewFinding,
  TestResult,
  CodeAgentOutput,
} from '../phase-results.js'
import { openDraftPr, getChangedFiles } from '../../git/git-operations.js'
import { createIterationLogger } from './iteration-logger.js'
import { parseStructuredOutput } from '../../drivers/output-parser.js'
import { executeDag, TaskExhaustedError } from './dag-executor.js'
import type { GitState } from '../phase-results.js'

// === Agent Handle ===

export interface AgentHandle {
  taskId: string
  sessionId: string       // UUID
  task: import('../plan/task-parser.js').PlannerTask
  filesChanged: string[]  // cumulative across iterations
  status: 'active' | 'green' | 'closed'
}

// === Exported Helpers (used by dag-executor.ts) ===

export function isRetryableErrorCode(code: string): boolean {
  return code === 'timeout' || code === 'crash' || code === 'empty_output' || code === 'invalid_json'
}

export function isImmediateFailErrorCode(code: string): boolean {
  return code === 'aborted' || code === 'spawn_error'
}

export function findingSignature(f: ReviewFinding): string {
  return `${f.file}:${f.line ?? 0}:${f.category}`
}

export function deduplicateFindings(
  findings: ReviewFinding[],
  seenSignatures: Set<string>
): ReviewFinding[] {
  const deduplicated: ReviewFinding[] = []
  const currentSet = new Set<string>()

  for (const finding of findings) {
    const sig = findingSignature(finding)
    if (currentSet.has(sig)) continue
    currentSet.add(sig)

    const isRecurring = seenSignatures.has(sig)
    seenSignatures.add(sig)

    deduplicated.push({
      ...finding,
      description: `${isRecurring ? '[RECURRING] ' : '[NEW] '}${finding.description}`,
    })
  }

  return deduplicated
}

export function extractCodeAgentOutput(output: string): CodeAgentOutput | null {
  const parsed = parseStructuredOutput(output)
  if (!parsed.ok) return null

  try {
    const json = JSON.parse(parsed.output) as Partial<CodeAgentOutput>
    return {
      filesChanged: json.filesChanged ?? [],
      testResult: {
        totalTests: json.testResult?.totalTests ?? 0,
        passingTests: json.testResult?.passingTests ?? 0,
        failingTests: json.testResult?.failingTests ?? 0,
        durationMs: json.testResult?.durationMs ?? 0,
      },
      buildResult: json.buildResult ?? null,
      summary: json.summary ?? '',
    }
  } catch {
    return null
  }
}

export const DEFAULT_TEST_RESULT: TestResult = { totalTests: 0, passingTests: 0, failingTests: 0, durationMs: 0 }

// === Decision Log ===

export function buildDecisionEntry(iteration: number, finding: ReviewFinding): string {
  return `- **Iteration ${iteration}** | ${finding.file}${finding.line ? `:${finding.line}` : ''} | ${finding.severity} ${finding.category}: ${finding.description.replace(/^\[(NEW|RECURRING)\]\s*/, '')} → **Applied fix**: ${finding.suggestedFix ?? 'N/A'}`
}

export function buildDecisionLogSection(entries: string[]): string {
  if (entries.length === 0) return ''
  return [
    '# Previous Iteration Decisions',
    '',
    'The following findings were addressed in previous iterations. These decisions are **FINAL**.',
    'Do NOT re-open, reverse, or contradict them unless you have concrete evidence that the applied fix introduced a NEW bug or regression.',
    'Disagreeing with a design tradeoff (e.g., "novalidate should/shouldn\'t be used") is NOT a valid reason to re-open — the tradeoff was already evaluated and decided.',
    '',
    ...entries,
    '',
  ].join('\n')
}

// === Finding Attribution ===

export function attributeFindingsToAgents(
  findings: ReviewFinding[],
  handles: AgentHandle[]
): Map<string, ReviewFinding[]> {
  const attribution = new Map<string, ReviewFinding[]>()
  const unmatched: ReviewFinding[] = []

  for (const finding of findings) {
    let matched = false
    for (const handle of handles) {
      if (handle.status === 'closed') continue
      if (handle.filesChanged.some(file => finding.file === file)) {
        const list = attribution.get(handle.taskId) ?? []
        list.push(finding)
        attribution.set(handle.taskId, list)
        matched = true
        break
      }
    }
    if (!matched) {
      unmatched.push(finding)
    }
  }

  // Broadcast unmatched findings to ALL active agents (safety net)
  if (unmatched.length > 0) {
    for (const handle of handles) {
      if (handle.status === 'closed') continue
      const list = attribution.get(handle.taskId) ?? []
      list.push(...unmatched)
      attribution.set(handle.taskId, list)
    }
  }

  return attribution
}

// === API ===

export { TaskExhaustedError } from './dag-executor.js'

export async function runCodePhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  plan: PlanPhaseResult,
  signal?: AbortSignal
): Promise<CodePhaseResult> {
  const startTime = Date.now()

  // Check abort
  if (signal?.aborted) {
    ctx.emitter.emit({
      type: 'phase:error',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: 'code', reason: 'Aborted' },
    })
    throw new Error('Code phase aborted')
  }

  // Emit phase:start
  ctx.emitter.emit({
    type: 'phase:start',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'code' },
  })

  // Dry run — return early
  if (ctx.dryRun) {
    const result: CodePhaseResult = {
      waves: [],
      iterations: [],
      finalTestResult: DEFAULT_TEST_RESULT,
      gitState: { branch: '', commits: [] },
      changedFiles: [],
      success: true,
    }

    ctx.emitter.emit({
      type: 'phase:end',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: 'code', durationMs: Date.now() - startTime },
    })

    return result
  }

  // Branch is created as a worktree by CLI before code phase
  const gitState: GitState = { branch: ctx.worktreeBranch ?? `swarm/${ctx.sessionId}`, commits: [] }

  try {
    if (gitState.branch) {
      const { prNumber, prUrl } = await openDraftPr(gitState.branch, ctx.sessionId, ctx.projectDir)
      gitState.prNumber = prNumber
      gitState.prUrl = prUrl
    }
  } catch (err) {
    process.stderr.write(`Warning: failed to open draft PR: ${(err as Error).message}\n`)
  }

  // Create iteration logger
  const logger = createIterationLogger(ctx.projectDir, ctx.sessionId)

  // Spec context for review
  const specItemContext = plan.plannerOutput.slice(0, 4096)

  // Execute DAG (wave-based scheduling — TDD runs per-wave inside)
  const dagResult = await executeDag(
    ctx, registry, plan.tasks, plan.techStack,
    specItemContext, plan.plannerOutput, signal, logger, gitState
  )

  const lastOutcome = dagResult.lastOutcome
  const finalTestResult = lastOutcome?.testResult ?? DEFAULT_TEST_RESULT
  const finalReview = lastOutcome && 'review' in lastOutcome ? lastOutcome.review : undefined
  const allGreen = dagResult.taskCompletions.every(tc => tc.status === 'green')
  const success = dagResult.taskCompletions.length === 0 || allGreen

  // Final changed files from git — includes everything across all iterations
  let finalChangedFiles: string[] = []
  try {
    finalChangedFiles = await getChangedFiles(ctx.projectDir)
  } catch (err) {
    process.stderr.write(`Warning: failed to detect changed files: ${(err as Error).message}\n`)
  }

  const result: CodePhaseResult = {
    waves: [],
    iterations: dagResult.iterations,
    finalTestResult,
    finalReview,
    gitState,
    changedFiles: finalChangedFiles,
    success,
    taskCompletions: dagResult.taskCompletions,
  }

  // Save state
  try {
    const loadResult = ctx.state.load()
    if (loadResult.found && 'valid' in loadResult && loadResult.valid) {
      const state = loadResult.state
      state.currentPhase = 'code'
      state.completedPhases = [...state.completedPhases, 'code']
      state.phaseResults = { ...state.phaseResults, code: result }
      state.updatedAt = new Date().toISOString()
      ctx.state.save(state)
    }
  } catch (err) {
    process.stderr.write(`Warning: state save failed: ${(err as Error).message}\n`)
  }

  // Emit phase:end
  ctx.emitter.emit({
    type: 'phase:end',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'code', durationMs: Date.now() - startTime },
  })

  // If any tasks failed, throw TaskExhaustedError
  if (!success) {
    const failedTask = dagResult.taskCompletions.find(tc => tc.status === 'failed')!
    throw new TaskExhaustedError(
      failedTask.taskId,
      failedTask.attempts,
      finalReview?.findings ?? [],
    )
  }

  return result
}

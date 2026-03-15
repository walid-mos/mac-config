// === DAG Task Executor (wave-based scheduling) ===

import { randomUUID } from 'node:crypto'
import {
  CODE_PHASE_TIMEOUT_SIGNAL_REASON,
  type RuntimeTerminalStatus,
  type SessionContext,
} from '../../core/types.js'
import type { DriverRegistry } from '../../drivers/driver.js'
import type { TechStack } from '../../detect/tech-stack.js'
import type {
  ReviewFinding,
  TestResult,
  IterationState,
  IterationOutcome,
  GitState,
  TaskCompletionRecord,
  IterationExecutionMetadata,
  IterationTddMetadata,
} from '../phase-results.js'
import type { PlannerTask } from '../plan/task-parser.js'
import { buildDependencyGraph } from '../plan/task-scheduler.js'
import { runReviewPhase } from './review-merge.js'
import { buildCodeAgentPrompt, buildFindingFixPrompt } from './code-agent-prompt.js'
import { commitSpecItem, getChangedFiles } from '../../git/git-operations.js'
import type { IterationLogger } from './iteration-logger.js'
import { runTddForTasks } from '../tdd/tdd-phase.js'
import {
  type AgentHandle,
  attributeFindingsToAgents,
  deduplicateFindings,
  buildDecisionEntry,
  buildDecisionLogSection,
  extractCodeAgentOutput,
  isRetryableErrorCode,
  isImmediateFailErrorCode,
  DEFAULT_TEST_RESULT,
} from './code-phase.js'

// === Constants ===

const MAX_RETRIES = 2
export const MAX_TASK_ATTEMPTS = 3

// === Types ===

export type TaskStatus = 'pending' | 'running' | 'converging' | 'green' | 'failed'

export interface TaskNode {
  taskId: string
  task: PlannerTask
  status: TaskStatus
  handle: AgentHandle
  lastFindings?: ReviewFinding[]
  attempts: number
  commitHash?: string
  decisionLogEntries: string[]
  seenSignatures: Set<string>
}

export interface DagExecutorResult {
  taskCompletions: TaskCompletionRecord[]
  iterations: IterationState[]
  terminalStatus: RuntimeTerminalStatus
  lastOutcome?: IterationOutcome
}

interface AgentExecutionResult {
  output: ReturnType<typeof extractCodeAgentOutput>
  deltaFiles: string[]
}

// === Errors ===

// === Helpers ===

async function spawnFreshAgent(
  node: TaskNode,
  ctx: SessionContext,
  registry: DriverRegistry,
  techStack: TechStack,
  testFiles: string[],
  decisionLog: string,
  signal?: AbortSignal,
): Promise<AgentExecutionResult> {
  const { driver, model, agent } = registry.getDriver('code', node.task.tag)
  const prompt = buildCodeAgentPrompt(node.task, testFiles, techStack, undefined, decisionLog)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    throwIfAborted(signal)

    const result = await driver.invoke({
      prompt,
      role: 'code',
      agent,
      model,
      projectDir: ctx.projectDir,
      signal,
      sessionId: node.handle.sessionId,
    })

    if (result.success) {
      const output = extractCodeAgentOutput(result.output)
      const deltaFiles: string[] = []
      if (output) {
        for (const f of output.filesChanged) {
          if (!node.handle.filesChanged.includes(f)) {
            node.handle.filesChanged.push(f)
          }
          deltaFiles.push(f)
        }
      }
      return { output, deltaFiles }
    }

    if (isImmediateFailErrorCode(result.errorCode)) {
      throw new Error(`Code agent failed: ${result.errorCode}: ${result.error}`)
    }

    if (isRetryableErrorCode(result.errorCode) && attempt < MAX_RETRIES) {
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role: 'code', reason: `${result.errorCode}: ${result.error}` },
      })
      continue
    }

    throw new Error(`Code agent failed after ${attempt + 1} attempts: ${result.errorCode}`)
  }

  return { output: null, deltaFiles: [] }
}

async function resumeAgentWithFindings(
  node: TaskNode,
  ctx: SessionContext,
  registry: DriverRegistry,
  techStack: TechStack,
  testFiles: string[],
  decisionLog: string,
  signal?: AbortSignal,
): Promise<AgentExecutionResult> {
  const { driver, model, agent } = registry.getDriver('code', node.task.tag)
  const findings = node.lastFindings ?? []
  const prompt = buildFindingFixPrompt(findings, decisionLog)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    throwIfAborted(signal)

    const isFirstAttempt = attempt === 0
    const result = await driver.invoke({
      prompt,
      role: 'code',
      agent,
      model,
      projectDir: ctx.projectDir,
      signal,
      ...(isFirstAttempt ? { resume: node.handle.sessionId } : {}),
    })

    if (result.success) {
      const output = extractCodeAgentOutput(result.output)
      const deltaFiles: string[] = []
      if (output) {
        for (const f of output.filesChanged) {
          if (!node.handle.filesChanged.includes(f)) {
            node.handle.filesChanged.push(f)
          }
          deltaFiles.push(f)
        }
      }
      return { output, deltaFiles }
    }

    // On first resume failure, fall back to fresh invocation with full prompt
    if (isFirstAttempt && isRetryableErrorCode(result.errorCode)) {
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role: 'code', reason: `Resume failed (${result.errorCode}), falling back to fresh invocation` },
      })
      const fullPrompt = buildCodeAgentPrompt(node.task, testFiles, techStack, findings, decisionLog)
      const fallbackResult = await driver.invoke({
        prompt: fullPrompt,
        role: 'code',
        agent,
        model,
        projectDir: ctx.projectDir,
        signal,
      })

      if (fallbackResult.success) {
        const output = extractCodeAgentOutput(fallbackResult.output)
        const deltaFiles: string[] = []
        if (output) {
          for (const f of output.filesChanged) {
            if (!node.handle.filesChanged.includes(f)) {
              node.handle.filesChanged.push(f)
            }
            deltaFiles.push(f)
          }
        }
        return { output, deltaFiles }
      }

      if (isImmediateFailErrorCode(fallbackResult.errorCode)) {
        throw new Error(`Code agent failed: ${fallbackResult.errorCode}: ${fallbackResult.error}`)
      }
      continue
    }

    if (isImmediateFailErrorCode(result.errorCode)) {
      throw new Error(`Code agent failed: ${result.errorCode}: ${result.error}`)
    }

    if (isRetryableErrorCode(result.errorCode) && attempt < MAX_RETRIES) {
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role: 'code', reason: `${result.errorCode}: ${result.error}` },
      })
      continue
    }

    throw new Error(`Code agent failed after ${attempt + 1} attempts: ${result.errorCode}`)
  }

  return { output: null, deltaFiles: [] }
}

function createFilesByTask(wave: TaskNode[], perTaskDeltaFiles: Map<string, string[]>): Record<string, string[]> {
  const filesByTask: Record<string, string[]> = {}

  for (const node of wave) {
    filesByTask[node.taskId] = perTaskDeltaFiles.get(node.taskId) ?? []
  }

  return filesByTask
}

function createIterationMetadata(
  wave: TaskNode[],
  pendingInWave: TaskNode[],
  fixable: TaskNode[],
  reviewedFiles: string[],
  perTaskDeltaFiles: Map<string, string[]>,
  tdd: IterationTddMetadata,
): IterationExecutionMetadata {
  return {
    taskIds: wave.map(node => node.taskId),
    pendingTaskIds: pendingInWave.map(node => node.taskId),
    convergingTaskIds: fixable.map(node => node.taskId),
    reviewedFiles,
    filesByTask: createFilesByTask(wave, perTaskDeltaFiles),
    tdd,
  }
}

function isTimeoutAbort(signal: AbortSignal | undefined): boolean {
  if (!signal?.aborted) return false

  const reason = signal.reason
  if (reason === CODE_PHASE_TIMEOUT_SIGNAL_REASON) return true
  if (reason instanceof Error && reason.message === CODE_PHASE_TIMEOUT_SIGNAL_REASON) return true

  return false
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return

  const reason = signal.reason
  if (reason instanceof Error) throw reason
  if (typeof reason === 'string' && reason.length > 0) throw new Error(reason)
  throw new Error('DAG execution aborted')
}

function buildTaskCompletions(
  nodes: Map<string, TaskNode>,
  fallbackStatus: Exclude<RuntimeTerminalStatus, 'green'>,
): TaskCompletionRecord[] {
  return [...nodes.values()].map(node => ({
    taskId: node.taskId,
    title: node.task.title,
    status: node.status === 'green' ? 'green' : fallbackStatus,
    attempts: node.attempts,
    commitHash: node.commitHash,
  }))
}

function buildTerminalOutcome(
  status: Exclude<RuntimeTerminalStatus, 'green'>,
  previousOutcome: IterationOutcome | undefined,
  reason?: string,
): IterationOutcome {
  const testResult = previousOutcome?.testResult ?? DEFAULT_TEST_RESULT
  const review = previousOutcome && 'review' in previousOutcome ? previousOutcome.review : undefined

  if (status === 'failed') {
    return { status, testResult, ...(review ? { review } : {}), reason: reason ?? 'Code execution failed' }
  }

  if (status === 'timeout') {
    return {
      status,
      ...(previousOutcome?.testResult ? { testResult } : {}),
      ...(review ? { review } : {}),
    }
  }

  return { status, testResult, ...(review ? { review } : {}) }
}

function recordTerminalIteration(
  iterations: IterationState[],
  iteration: number,
  outcome: IterationOutcome,
): void {
  const lastIteration = iterations.at(-1)
  if (lastIteration?.iteration === iteration && lastIteration.outcome.status === outcome.status) {
    return
  }

  iterations.push({ iteration, outcome, changedFiles: [] })
}

function emitIterationEnd(
  ctx: SessionContext,
  iteration: number,
  outcome: IterationOutcome,
): void {
  ctx.emitter.emit({
    type: 'iteration:end',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: {
      iteration,
      success: outcome.status === 'green',
      status: outcome.status,
      reason: outcome.status === 'needs-iteration'
        ? 'review-findings'
        : outcome.status === 'green'
          ? undefined
          : outcome.status,
    },
  })
}

// === API ===

export async function executeDag(
  ctx: SessionContext,
  registry: DriverRegistry,
  tasks: PlannerTask[],
  techStack: TechStack,
  plannerOutput: string,
  signal: AbortSignal | undefined,
  logger: IterationLogger,
  gitState: GitState,
): Promise<DagExecutorResult> {
  if (tasks.length === 0) {
    return { taskCompletions: [], iterations: [], terminalStatus: 'green' }
  }

  const { dependents, taskMap } = buildDependencyGraph(tasks)

  // Initialize task nodes with mutable remaining-dependency counts
  const nodes = new Map<string, TaskNode>()
  const remainingDeps = new Map<string, number>()

  for (const task of tasks) {
    const validDeps = task.dependencies.filter(d => taskMap.has(d))
    remainingDeps.set(task.id, validDeps.length)
    nodes.set(task.id, {
      taskId: task.id,
      task,
      status: 'pending',
      handle: {
        taskId: task.id,
        sessionId: randomUUID(),
        task,
        filesChanged: [],
        status: 'active',
      },
      attempts: 0,
      decisionLogEntries: [],
      seenSignatures: new Set(),
    })
  }

  const iterations: IterationState[] = []
  let lastOutcome: IterationOutcome | undefined
  let waveIndex = 0
  const accumulatedTestFiles: string[] = []

  try {
    // Main loop — each iteration is one "wave"
    while (true) {
      if (isTimeoutAbort(signal)) {
        const outcome = buildTerminalOutcome('timeout', lastOutcome)
        recordTerminalIteration(iterations, waveIndex, outcome)
        return {
          taskCompletions: buildTaskCompletions(nodes, 'timeout'),
          iterations,
          terminalStatus: 'timeout',
          lastOutcome: outcome,
        }
      }

      throwIfAborted(signal)

      // 1. Find ready tasks: status=pending AND all deps green
      const ready: TaskNode[] = []
      for (const node of nodes.values()) {
        if (node.status === 'pending' && (remainingDeps.get(node.taskId) ?? 0) === 0) {
          ready.push(node)
        }
      }

      // 2. Find fixable tasks: status=converging AND has lastFindings
      const fixable: TaskNode[] = []
      for (const node of nodes.values()) {
        if (node.status === 'converging' && node.lastFindings && node.lastFindings.length > 0) {
          fixable.push(node)
        }
      }

      // Nothing left to process — exit
      if (ready.length === 0 && fixable.length === 0) break

      // 3. Build wave (ready + fixable)
      const wave = [...ready, ...fixable]
      const waveHandles: AgentHandle[] = wave.map(n => n.handle)
      const perTaskDeltaFiles = new Map<string, string[]>()

      ctx.emitter.emit({
        type: 'iteration:start',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: {
          iteration: waveIndex,
          waveIndex,
          taskCount: wave.length,
          taskIds: wave.map(n => n.taskId),
        },
      })

      // 4. Run TDD for pending tasks in this wave (not converging/fix tasks)
      const pendingInWave = wave.filter(n => n.status === 'pending')
      const tddPromise = pendingInWave.length > 0
        ? runTddForTasks(
          ctx,
          registry,
          plannerOutput,
          pendingInWave.map(node => node.task),
          techStack,
          signal,
        )
        : null

      const convergingAgentPromises = fixable.map(async (node) => {
        const decisionLog = buildDecisionLogSection(node.decisionLogEntries)
        const result = await resumeAgentWithFindings(
          node,
          ctx,
          registry,
          techStack,
          accumulatedTestFiles,
          decisionLog,
          signal,
        )

        perTaskDeltaFiles.set(node.taskId, result.deltaFiles)
        return result.output
      })

      let tddMetadata: IterationTddMetadata = { status: 'skipped', testFiles: [] }

      if (tddPromise) {
        try {
          const tddResult = await tddPromise
          tddMetadata = { status: 'succeeded', testFiles: tddResult.testFiles }

          for (const file of tddResult.testFiles) {
            if (!accumulatedTestFiles.includes(file)) {
              accumulatedTestFiles.push(file)
            }
          }
        } catch (err) {
          tddMetadata = { status: 'failed', testFiles: [] }
          process.stderr.write(`Warning: TDD for wave ${waveIndex} failed: ${(err as Error).message}\n`)
        }
      }

      throwIfAborted(signal)

      // 5. For each task in wave: spawn fresh (pending) or resume with findings (converging)
      let agentTestResult: TestResult = DEFAULT_TEST_RESULT

      const pendingAgentPromises = pendingInWave.map(async (node) => {
        const decisionLog = buildDecisionLogSection(node.decisionLogEntries)

        node.status = 'running'
        const result = await spawnFreshAgent(
          node,
          ctx,
          registry,
          techStack,
          accumulatedTestFiles,
          decisionLog,
          signal,
        )
        perTaskDeltaFiles.set(node.taskId, result.deltaFiles)
        return result.output
      })

      const agentOutputs = await Promise.all([
        ...convergingAgentPromises,
        ...pendingAgentPromises,
      ])

      // 6. Extract best test result from agent outputs
      for (const output of agentOutputs) {
        if (output?.testResult && output.testResult.totalTests > agentTestResult.totalTests) {
          agentTestResult = output.testResult
        }
      }

      // 7. Run review on wave-local changes, falling back to repo changes when needed
      const waveChangedFiles = [...new Set(
        [...perTaskDeltaFiles.values()].flatMap(files => files)
      )]
      const reviewedFiles = waveChangedFiles.length > 0
        ? waveChangedFiles
        : await getChangedFiles(ctx.projectDir)
      const globalDecisionLog = buildDecisionLogSection(
        [...nodes.values()].flatMap(n => n.decisionLogEntries)
      )

      const review = await runReviewPhase(
        ctx, registry, reviewedFiles, agentTestResult, signal, globalDecisionLog, waveIndex, iterations
      )

      logger.logReview(waveIndex, 0, review)
      if (agentTestResult.totalTests > 0) {
        logger.logTestResult(waveIndex, 0, agentTestResult)
      }

      // 8. Attribute blocking findings to wave tasks
      let blockingFindings = review.findings.filter(
        f => f.severity === 'critical' || f.severity === 'important'
      )

      if (review.convergenceRecommendation === 'converged') {
        const demoted = blockingFindings.filter(f => f.severity === 'important')
        if (demoted.length > 0) {
          process.stderr.write(
            `[convergence] Merge agent recommends converged — demoting ${demoted.length} important finding(s)\n`
          )
        }
        blockingFindings = blockingFindings.filter(f => f.severity === 'critical')
      }
      const attribution = attributeFindingsToAgents(blockingFindings, waveHandles)

      const uncommittedFiles = new Set(await getChangedFiles(ctx.projectDir))

      // 9. Per-task decision
      const greenNodes: TaskNode[] = []
      let needsAnotherIteration = false
      let reachedMaxAttempts = false

      for (const node of wave) {
        node.attempts++
        const taskFindings = attribution.get(node.taskId) ?? []
        const deduplicated = deduplicateFindings(taskFindings, node.seenSignatures)

        if (deduplicated.length === 0) {
          node.status = 'green'
          node.handle.status = 'green'
          greenNodes.push(node)

          for (const depId of dependents.get(node.taskId) ?? []) {
            remainingDeps.set(depId, (remainingDeps.get(depId) ?? 1) - 1)
          }
        } else if (node.attempts >= MAX_TASK_ATTEMPTS) {
          node.status = 'failed'
          node.handle.status = 'closed'
          reachedMaxAttempts = true
        } else {
          node.status = 'converging'
          needsAnotherIteration = true

          if (node.lastFindings && node.lastFindings.length > 0) {
            for (const f of node.lastFindings) {
              node.decisionLogEntries.push(buildDecisionEntry(node.attempts - 1, f))
            }
          }

          node.lastFindings = deduplicated
        }

        logger.logIterationSummary(waveIndex, node.attempts - 1, {
          waveIndex,
          attempt: node.attempts - 1,
          status: node.status === 'green'
            ? 'green'
            : node.status === 'failed'
              ? 'max-iterations'
              : 'needs-iteration',
          reason: node.status === 'green'
            ? undefined
            : node.status === 'failed'
              ? 'max-iterations'
              : 'review-findings',
          criticalCount: review.criticalCount,
          testResult: agentTestResult,
        })
      }

      for (const node of greenNodes) {
        const taskFiles = node.handle.filesChanged.filter(f => uncommittedFiles.has(f))
        if (taskFiles.length === 0) continue

        try {
          const msg = `feat(swarm): ${node.task.title}`
          const hash = await commitSpecItem(ctx.projectDir, taskFiles, msg)
          node.commitHash = hash
          gitState.commits.push({ hash, message: msg, specItem: node.task.title, iteration: waveIndex })
          for (const f of taskFiles) uncommittedFiles.delete(f)

          ctx.emitter.emit({
            type: 'commit',
            timestamp: new Date().toISOString(),
            sessionId: ctx.sessionId,
            data: { hash, message: msg, filesChanged: taskFiles.length },
          })
        } catch (err) {
          process.stderr.write(`Warning: commit failed for ${node.taskId}: ${(err as Error).message}\n`)
        }
      }

      const outcome: IterationOutcome = reachedMaxAttempts
        ? { status: 'max-iterations', testResult: agentTestResult, review }
        : needsAnotherIteration
          ? { status: 'needs-iteration', testResult: agentTestResult, review, reason: 'review-findings' }
          : { status: 'green', testResult: agentTestResult, review }

      iterations.push({
        iteration: waveIndex,
        outcome,
        changedFiles: reviewedFiles,
        metadata: createIterationMetadata(wave, pendingInWave, fixable, reviewedFiles, perTaskDeltaFiles, tddMetadata),
      })
      lastOutcome = outcome

      emitIterationEnd(ctx, waveIndex, outcome)

      if (reachedMaxAttempts) {
        return {
          taskCompletions: buildTaskCompletions(nodes, 'max-iterations'),
          iterations,
          terminalStatus: 'max-iterations',
          lastOutcome,
        }
      }

      waveIndex++
    }
  } catch (err) {
    if (isTimeoutAbort(signal)) {
      const outcome = buildTerminalOutcome('timeout', lastOutcome)
      recordTerminalIteration(iterations, waveIndex, outcome)
      emitIterationEnd(ctx, waveIndex, outcome)
      return {
        taskCompletions: buildTaskCompletions(nodes, 'timeout'),
        iterations,
        terminalStatus: 'timeout',
        lastOutcome: outcome,
      }
    }

    if (signal?.aborted) throw err

    const outcome = buildTerminalOutcome('failed', lastOutcome, (err as Error).message)
    recordTerminalIteration(iterations, waveIndex, outcome)
    emitIterationEnd(ctx, waveIndex, outcome)
    return {
      taskCompletions: buildTaskCompletions(nodes, 'failed'),
      iterations,
      terminalStatus: 'failed',
      lastOutcome: outcome,
    }
  }

  const hasUnfinishedTasks = [...nodes.values()].some(node => node.status !== 'green')
  if (hasUnfinishedTasks) {
    const outcome = buildTerminalOutcome('failed', lastOutcome, 'DAG execution stopped before all tasks completed')
    recordTerminalIteration(iterations, waveIndex, outcome)
    return {
      taskCompletions: buildTaskCompletions(nodes, 'failed'),
      iterations,
      terminalStatus: 'failed',
      lastOutcome: outcome,
    }
  }

  return {
    taskCompletions: buildTaskCompletions(nodes, 'failed'),
    iterations,
    terminalStatus: 'green',
    lastOutcome,
  }
}

// === DAG Task Executor (wave-based scheduling) ===

import { randomUUID } from 'node:crypto'
import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry } from '../../drivers/driver.js'
import type { TechStack } from '../../detect/tech-stack.js'
import type {
  ReviewFinding,
  TestResult,
  IterationState,
  IterationOutcome,
  GitState,
  TaskCompletionRecord,
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

// === Types ===

export type TaskStatus = 'pending' | 'running' | 'converging' | 'green'

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
  lastOutcome?: IterationOutcome
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
): Promise<ReturnType<typeof extractCodeAgentOutput>> {
  const { driver, model, agent } = registry.getDriver('code', node.task.tag)
  const prompt = buildCodeAgentPrompt(node.task, testFiles, techStack, undefined, decisionLog)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error('DAG execution aborted')

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
      if (output) {
        for (const f of output.filesChanged) {
          if (!node.handle.filesChanged.includes(f)) {
            node.handle.filesChanged.push(f)
          }
        }
      }
      return output
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

  return null
}

async function resumeAgentWithFindings(
  node: TaskNode,
  ctx: SessionContext,
  registry: DriverRegistry,
  techStack: TechStack,
  testFiles: string[],
  decisionLog: string,
  signal?: AbortSignal,
): Promise<ReturnType<typeof extractCodeAgentOutput>> {
  const { driver, model, agent } = registry.getDriver('code', node.task.tag)
  const findings = node.lastFindings ?? []
  const prompt = buildFindingFixPrompt(findings, decisionLog)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error('DAG execution aborted')

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
      if (output) {
        for (const f of output.filesChanged) {
          if (!node.handle.filesChanged.includes(f)) {
            node.handle.filesChanged.push(f)
          }
        }
      }
      return output
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
        if (output) {
          for (const f of output.filesChanged) {
            if (!node.handle.filesChanged.includes(f)) {
              node.handle.filesChanged.push(f)
            }
          }
        }
        return output
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

  return null
}

// === API ===

export async function executeDag(
  ctx: SessionContext,
  registry: DriverRegistry,
  tasks: PlannerTask[],
  techStack: TechStack,
  specItemContext: string,
  plannerOutput: string,
  signal: AbortSignal | undefined,
  logger: IterationLogger,
  gitState: GitState,
): Promise<DagExecutorResult> {
  if (tasks.length === 0) {
    return { taskCompletions: [], iterations: [] }
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

  // Main loop — each iteration is one "wave"
  while (true) {
    if (signal?.aborted) throw new Error('DAG execution aborted')

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
    if (pendingInWave.length > 0) {
      try {
        const tddResult = await runTddForTasks(
          ctx, registry, plannerOutput,
          pendingInWave.map(n => n.task), techStack, signal
        )
        for (const f of tddResult.testFiles) {
          if (!accumulatedTestFiles.includes(f)) {
            accumulatedTestFiles.push(f)
          }
        }
      } catch (err) {
        // TDD failure is non-fatal — log and continue with whatever test files we have
        process.stderr.write(`Warning: TDD for wave ${waveIndex} failed: ${(err as Error).message}\n`)
      }
    }

    // 5. For each task in wave: spawn fresh (pending) or resume with findings (converging)
    let agentTestResult: TestResult = DEFAULT_TEST_RESULT

    const agentOutputs = await Promise.all(
      wave.map(async (node) => {
        const decisionLog = buildDecisionLogSection(node.decisionLogEntries)

        if (node.status === 'pending') {
          node.status = 'running'
          return spawnFreshAgent(node, ctx, registry, techStack, accumulatedTestFiles, decisionLog, signal)
        }

        // Converging — resume with findings
        return resumeAgentWithFindings(node, ctx, registry, techStack, accumulatedTestFiles, decisionLog, signal)
      })
    )

    // 6. Extract best test result from agent outputs
    for (const output of agentOutputs) {
      if (output?.testResult && output.testResult.totalTests > agentTestResult.totalTests) {
        agentTestResult = output.testResult
      }
    }

    // 7. Run GLOBAL review on all changed files
    const allChangedFiles = await getChangedFiles(ctx.projectDir)
    const globalDecisionLog = buildDecisionLogSection(
      [...nodes.values()].flatMap(n => n.decisionLogEntries)
    )

    const review = await runReviewPhase(
      ctx, registry, allChangedFiles, specItemContext, agentTestResult, signal, globalDecisionLog
    )

    // Log review
    logger.logReview(waveIndex, 0, review)
    if (agentTestResult.totalTests > 0) {
      logger.logTestResult(waveIndex, 0, agentTestResult)
    }

    const reviewFailing = review.criticalCount + review.importantCount > 0
    const success = !reviewFailing

    const outcome: IterationOutcome = success
      ? { status: 'green', testResult: agentTestResult, review }
      : { status: 'needs-iteration', testResult: agentTestResult, review, reason: 'review-findings' }

    iterations.push({ iteration: iterations.length, outcome, changedFiles: allChangedFiles })
    lastOutcome = outcome

    ctx.emitter.emit({
      type: 'iteration:end',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { iteration: waveIndex, success, reason: success ? undefined : 'review-findings' },
    })

    // 8. Attribute blocking findings to wave tasks
    const blockingFindings = review.findings.filter(
      f => f.severity === 'critical' || f.severity === 'important'
    )
    const attribution = attributeFindingsToAgents(blockingFindings, waveHandles)

    // Track which files are still uncommitted for per-task commits
    const uncommittedFiles = new Set(allChangedFiles)

    // 9. Per-task decision
    const greenNodes: TaskNode[] = []

    for (const node of wave) {
      node.attempts++
      const taskFindings = attribution.get(node.taskId) ?? []
      const deduplicated = deduplicateFindings(taskFindings, node.seenSignatures)

      if (deduplicated.length === 0) {
        node.status = 'green'
        node.handle.status = 'green'
        greenNodes.push(node)

        // 10. Decrement dependents' remaining deps — they may become ready next wave
        for (const depId of dependents.get(node.taskId) ?? []) {
          remainingDeps.set(depId, (remainingDeps.get(depId) ?? 1) - 1)
        }
      } else {
        node.status = 'converging'

        // Record decisions from findings that were passed to agents (they were addressed)
        if (node.lastFindings && node.lastFindings.length > 0) {
          for (const f of node.lastFindings) {
            node.decisionLogEntries.push(buildDecisionEntry(node.attempts - 1, f))
          }
        }

        node.lastFindings = deduplicated
      }

      // Log per-task summary
      logger.logIterationSummary(waveIndex, node.attempts - 1, {
        waveIndex,
        attempt: node.attempts - 1,
        status: node.status === 'green' ? 'green' : 'needs-iteration',
        reason: node.status === 'converging' ? 'review-findings' : undefined,
        criticalCount: review.criticalCount,
        testResult: agentTestResult,
      })
    }

    // Commit green tasks
    for (const node of greenNodes) {
      const taskFiles = node.handle.filesChanged.filter(f => uncommittedFiles.has(f))
      if (taskFiles.length === 0) continue

      try {
        const msg = `feat(swarm): ${node.task.title}`
        const hash = await commitSpecItem(ctx.projectDir, taskFiles, msg)
        node.commitHash = hash
        gitState.commits.push({ hash, message: msg, specItem: node.task.title, iteration: iterations.length - 1 })
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

    waveIndex++
  }

  // Build completion records
  const taskCompletions: TaskCompletionRecord[] = []
  for (const node of nodes.values()) {
    taskCompletions.push({
      taskId: node.taskId,
      title: node.task.title,
      status: 'green',
      attempts: node.attempts,
      commitHash: node.commitHash,
    })
  }

  return { taskCompletions, iterations, lastOutcome }
}

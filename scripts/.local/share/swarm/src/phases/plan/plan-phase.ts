// === Plan Phase (Spec 3 — FR-1, FR-7, FR-8, FR-11) ===

import { readdirSync } from 'node:fs'
import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry, AgentResult } from '../../drivers/driver.js'
import type { PlanPhaseResult } from '../phase-results.js'
import { buildPlannerPrompt } from './planner-prompt.js'
import { parseTaskDecomposition, parseTechStack } from './task-parser.js'
import type { TaskTag } from './task-parser.js'

// === Constants ===

const MAX_PLANNER_OUTPUT_BYTES = 256 * 1024 // 256KB
const MAX_RETRIES = 2

// === Helpers ===

function getProjectStructure(projectDir: string): string[] {
  try {
    return readdirSync(projectDir).map(entry => entry + (entry.includes('.') ? '' : '/'))
  } catch {
    return []
  }
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_PLANNER_OUTPUT_BYTES) return output
  return output.slice(0, MAX_PLANNER_OUTPUT_BYTES)
}

function isRetryableErrorCode(code: string): boolean {
  return code === 'timeout' || code === 'crash' || code === 'empty_output' || code === 'invalid_json'
}

function isImmediateFailErrorCode(code: string): boolean {
  return code === 'aborted' || code === 'spawn_error'
}

// === API ===

export async function runPlanPhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  specItemContent: string,
  signal?: AbortSignal
): Promise<PlanPhaseResult> {
  const startTime = Date.now()

  // Check abort signal
  if (signal?.aborted) {
    ctx.emitter.emit({
      type: 'phase:error',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: 'plan', reason: 'Aborted' },
    })
    throw new Error('Plan phase aborted')
  }

  // Emit phase:start
  ctx.emitter.emit({
    type: 'phase:start',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'plan' },
  })

  // Step 1: Build planner prompt
  const projectStructure = getProjectStructure(ctx.projectDir)
  const prompt = buildPlannerPrompt(specItemContent, projectStructure)

  // Step 2: Invoke planner agent with retry logic
  const { driver, model, agent } = registry.getDriver('plan')
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check abort before each attempt
    if (signal?.aborted) {
      ctx.emitter.emit({
        type: 'phase:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: 'plan', reason: 'Aborted' },
      })
      throw new Error('Plan phase aborted')
    }

    const agentResult: AgentResult = await driver.invoke({
      prompt,
      role: 'plan',
      agent,
      model,
      projectDir: ctx.projectDir,
      swarmSessionId: ctx.sessionId,
    })

    // Handle agent failure
    if (!agentResult.success) {
      if (isImmediateFailErrorCode(agentResult.errorCode)) {
        ctx.emitter.emit({
          type: 'phase:error',
          timestamp: new Date().toISOString(),
          sessionId: ctx.sessionId,
          data: { phase: 'plan', reason: `${agentResult.errorCode}: ${agentResult.error}` },
        })
        throw new Error(`Plan phase failed: ${agentResult.errorCode}: ${agentResult.error}`)
      }

      if (isRetryableErrorCode(agentResult.errorCode) && attempt < MAX_RETRIES) {
        ctx.emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: ctx.sessionId,
          data: { role: 'plan', reason: `${agentResult.errorCode}: ${agentResult.error}` },
        })
        continue
      }

      // All retries exhausted
      ctx.emitter.emit({
        type: 'phase:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: 'plan', reason: `All retries exhausted: ${agentResult.errorCode}: ${agentResult.error}` },
      })
      throw new Error(`Plan phase failed after ${attempt + 1} attempts: ${agentResult.errorCode}`)
    }

    // Agent succeeded — parse output
    const plannerOutput = truncateOutput(agentResult.output)

    try {
      const { tasks } = parseTaskDecomposition(plannerOutput, ctx.projectDir)
      const techStack = parseTechStack(plannerOutput)

      // Compute tags summary
      const tags: Partial<Record<TaskTag, number>> = {}
      for (const task of tasks) {
        tags[task.tag] = (tags[task.tag] ?? 0) + 1
      }

      const result: PlanPhaseResult = {
        plannerOutput,
        tasks,
        techStack,
        taskCount: tasks.length,
        tags,
      }

      // Emit phase:end
      ctx.emitter.emit({
        type: 'phase:end',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: 'plan', durationMs: Date.now() - startTime, taskCount: tasks.length },
      })

      return result
    } catch (parseError) {
      lastError = parseError instanceof Error ? parseError : new Error(String(parseError))

      if (attempt < MAX_RETRIES) {
        // Structural validation failure — retry
        ctx.emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: ctx.sessionId,
          data: { role: 'plan', reason: lastError.message },
        })
        continue
      }
    }
  }

  // All retries exhausted
  ctx.emitter.emit({
    type: 'phase:error',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'plan', reason: lastError?.message ?? 'Unknown error' },
  })
  throw lastError ?? new Error('Plan phase failed')
}

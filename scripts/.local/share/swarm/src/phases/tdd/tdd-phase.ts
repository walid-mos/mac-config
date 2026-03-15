// === TDD Phase (Spec 3 — FR-4, FR-6, FR-7, FR-8, FR-11) ===

import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry, AgentResult } from '../../drivers/driver.js'
import type { PlanPhaseResult, TddPhaseResult, TddAgentOutput } from '../phase-results.js'
import { buildTestPrompt } from './test-prompt.js'
import { parseStructuredOutput } from '../../drivers/output-parser.js'

// === Constants ===

const MAX_RETRIES = 2

// === Helpers ===

function isRetryableErrorCode(code: string): boolean {
  return code === 'timeout' || code === 'crash' || code === 'empty_output' || code === 'invalid_json'
}

function isImmediateFailErrorCode(code: string): boolean {
  return code === 'aborted' || code === 'spawn_error'
}

function extractTddAgentOutput(output: string): TddAgentOutput | null {
  const parsed = parseStructuredOutput(output)
  if (!parsed.ok) return null

  try {
    const json = JSON.parse(parsed.output) as Partial<TddAgentOutput>
    if (!json.testFiles || !Array.isArray(json.testFiles)) return null
    return {
      testFiles: json.testFiles,
      testResult: {
        totalTests: json.testResult?.totalTests ?? 0,
        passingTests: json.testResult?.passingTests ?? 0,
        failingTests: json.testResult?.failingTests ?? 0,
        durationMs: json.testResult?.durationMs ?? 0,
      },
      isRed: json.isRed ?? false,
    }
  } catch {
    return null
  }
}

const DEFAULT_AGENT_OUTPUT: TddAgentOutput = {
  testFiles: ['tests/feature.test.ts'],
  testResult: { totalTests: 0, passingTests: 0, failingTests: 0, durationMs: 0 },
  isRed: false,
}

// === API ===

export async function runTddForTasks(
  ctx: SessionContext,
  registry: DriverRegistry,
  plannerOutput: string,
  tasks: import('../plan/task-parser.js').PlannerTask[],
  techStack: import('../../detect/tech-stack.js').TechStack,
  signal?: AbortSignal
): Promise<TddPhaseResult> {
  // Check abort signal
  if (signal?.aborted) {
    throw new Error('TDD aborted')
  }

  // Build test prompt
  const testConventions = [
    'tests/**/*.test.ts',
    `Use ${techStack.testRunner ?? 'default'} test runner`,
  ]
  const prompt = buildTestPrompt(plannerOutput, tasks, techStack, testConventions)

  // Get driver
  const { driver, model, agent } = registry.getDriver('test')

  let currentPrompt = prompt

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check abort before each attempt
    if (signal?.aborted) {
      throw new Error('TDD aborted')
    }

    const agentResult: AgentResult = await driver.invoke({
      prompt: currentPrompt,
      role: 'test',
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
          data: { phase: 'tdd', reason: `${agentResult.errorCode}: ${agentResult.error}` },
        })
        throw new Error(`TDD failed: ${agentResult.errorCode}: ${agentResult.error}`)
      }

      if (isRetryableErrorCode(agentResult.errorCode) && attempt < MAX_RETRIES) {
        const reason = agentResult.errorCode === 'timeout' && agentResult.stderr
          ? `${agentResult.errorCode}: ${agentResult.error} — stderr: ${agentResult.stderr.slice(0, 300)}`
          : `${agentResult.errorCode}: ${agentResult.error}`
        ctx.emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: ctx.sessionId,
          data: { role: 'test', reason },
        })
        continue
      }

      // All retries exhausted
      ctx.emitter.emit({
        type: 'phase:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: 'tdd', reason: `All retries exhausted: ${agentResult.errorCode}` },
      })
      throw new Error(`TDD failed after ${attempt + 1} attempts: ${agentResult.errorCode}`)
    }

    // Agent succeeded — parse structured JSON output
    const agentOutput = extractTddAgentOutput(agentResult.output) ?? DEFAULT_AGENT_OUTPUT

    // Check for zero tests — retry if possible
    if (agentOutput.testResult.totalTests === 0) {
      if (attempt < MAX_RETRIES) {
        currentPrompt = `${prompt}\n\n# Previous Attempt Failed — Zero Tests\n\nYour previous attempt produced zero compilable tests. Please produce compilable, failing test files. Remember to run the tests and include the JSON output block.`
        ctx.emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: ctx.sessionId,
          data: { role: 'test', reason: 'Zero tests produced' },
        })
        continue
      }
      // Final attempt — emit test:fail warning and return
      ctx.emitter.emit({
        type: 'test:fail',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { totalTests: 0, failingTests: 0, reason: 'Test agent produced zero tests' },
      })
      return { testFiles: agentOutput.testFiles, agentReport: agentOutput }
    }

    // Check isRed — retry if tests pass (not red)
    if (!agentOutput.isRed && attempt < MAX_RETRIES) {
      currentPrompt = `${prompt}\n\n# Previous Attempt Failed — Tests Not Red\n\nYour tests passed without implementation. Tests that pass before implementation are useless. Rewrite tests that properly fail.`
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role: 'test', reason: 'Tests not red — passed without implementation' },
      })
      continue
    }

    // Emit appropriate test event
    if (agentOutput.isRed) {
      ctx.emitter.emit({
        type: 'test:red',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: {
          totalTests: agentOutput.testResult.totalTests,
          passingTests: agentOutput.testResult.passingTests,
          failingTests: agentOutput.testResult.failingTests,
        },
      })
    } else {
      ctx.emitter.emit({
        type: 'test:green',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: {
          totalTests: agentOutput.testResult.totalTests,
          passingTests: agentOutput.testResult.passingTests,
        },
      })
    }

    return {
      testFiles: agentOutput.testFiles,
      agentReport: agentOutput,
    }
  }

  // All retries exhausted (shouldn't reach here, but safety net)
  ctx.emitter.emit({
    type: 'phase:error',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'tdd', reason: 'Unknown error' },
  })
  throw new Error('TDD failed')
}

export async function runTddPhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  plan: PlanPhaseResult,
  signal?: AbortSignal
): Promise<TddPhaseResult> {
  const startTime = Date.now()

  // Check abort signal
  if (signal?.aborted) {
    ctx.emitter.emit({
      type: 'phase:error',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: 'tdd', reason: 'Aborted' },
    })
    throw new Error('TDD phase aborted')
  }

  // Emit phase:start
  ctx.emitter.emit({
    type: 'phase:start',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'tdd' },
  })

  const result = await runTddForTasks(ctx, registry, plan.plannerOutput, plan.tasks, plan.techStack, signal)

  // Emit phase:end
  ctx.emitter.emit({
    type: 'phase:end',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'tdd', durationMs: Date.now() - startTime },
  })

  return result
}

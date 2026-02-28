// === TDD Phase (Spec 3 — FR-4, FR-6, FR-7, FR-8, FR-11) ===

import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry, AgentResult } from '../../drivers/driver.js'
import type { PlanPhaseResult, TddPhaseResult } from '../phase-results.js'
import { buildTestPrompt } from './test-prompt.js'
import { verifyRed } from './red-verification.js'

// === Constants ===

const MAX_RETRIES = 2
const MAX_ERROR_BYTES = 4096 // 4KB

// === Helpers ===

function extractTestFilePaths(output: string, projectDir: string): string[] {
  const paths: string[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    // Match patterns like "- tests/feature.test.ts" or "- /abs/path/tests/feature.test.ts"
    const match = /^-\s+(.+\.(?:test|spec)\.\w+)\s*$/i.exec(line.trim())
    if (!match) continue

    let filePath = match[1]!.trim()

    // Skip files outside projectDir
    if (filePath.startsWith('/')) {
      // Check if it's under projectDir
      if (filePath.startsWith(projectDir + '/')) {
        filePath = filePath.slice(projectDir.length + 1)
      } else {
        continue // Skip files outside projectDir boundary
      }
    }

    // Reject path traversal
    if (filePath.includes('..')) continue

    paths.push(filePath)
  }

  return paths.length > 0 ? paths : ['tests/feature.test.ts']
}

function sanitizeErrorOutput(errors: string[]): string {
  const combined = errors.join('\n')
  if (combined.length <= MAX_ERROR_BYTES) return combined
  return combined.slice(0, MAX_ERROR_BYTES) + '\n...(truncated)'
}

function isRetryableErrorCode(code: string): boolean {
  return code === 'timeout' || code === 'crash' || code === 'empty_output' || code === 'invalid_json'
}

function isImmediateFailErrorCode(code: string): boolean {
  return code === 'aborted' || code === 'spawn_error'
}

// === API ===

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

  // Build test prompt
  const testConventions = [
    'tests/**/*.test.ts',
    `Use ${plan.techStack.testRunner ?? 'default'} test runner`,
  ]
  const prompt = buildTestPrompt(plan.plannerOutput, plan.tasks, plan.techStack, testConventions)

  // Get driver
  const { driver, model } = registry.getDriver('test')

  let currentPrompt = prompt
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check abort before each attempt
    if (signal?.aborted) {
      ctx.emitter.emit({
        type: 'phase:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: 'tdd', reason: 'Aborted' },
      })
      throw new Error('TDD phase aborted')
    }

    const agentResult: AgentResult = await driver.invoke({
      prompt: currentPrompt,
      role: 'test',
      model,
      projectDir: ctx.projectDir,
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
        throw new Error(`TDD phase failed: ${agentResult.errorCode}: ${agentResult.error}`)
      }

      if (isRetryableErrorCode(agentResult.errorCode) && attempt < MAX_RETRIES) {
        ctx.emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: ctx.sessionId,
          data: { role: 'test', reason: `${agentResult.errorCode}: ${agentResult.error}` },
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
      throw new Error(`TDD phase failed after ${attempt + 1} attempts: ${agentResult.errorCode}`)
    }

    // Agent succeeded — extract test file paths and verify RED
    const testFiles = extractTestFilePaths(agentResult.output, ctx.projectDir)
    const redResult = await verifyRed(ctx.projectDir, plan.techStack, testFiles, signal)

    // Check for syntax errors — retry if present
    if (redResult.syntaxErrors.length > 0 && attempt < MAX_RETRIES) {
      const sanitized = sanitizeErrorOutput(redResult.syntaxErrors)
      currentPrompt = `${prompt}\n\n# Previous Attempt Failed — Syntax Errors\n\nThe tests you wrote had syntax errors. Please fix them:\n\n${sanitized}`
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role: 'test', reason: `Syntax errors in tests: ${redResult.syntaxErrors.length}` },
      })
      continue
    }

    // Emit appropriate test event
    if (redResult.isRed) {
      ctx.emitter.emit({
        type: 'test:red',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: {
          totalTests: redResult.totalTests,
          passingTests: redResult.passingTests,
          failingTests: redResult.failingTests,
        },
      })
    } else {
      ctx.emitter.emit({
        type: 'test:green',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: {
          totalTests: redResult.totalTests,
          passingTests: redResult.passingTests,
        },
      })
    }

    // Emit phase:end
    ctx.emitter.emit({
      type: 'phase:end',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: 'tdd', durationMs: Date.now() - startTime },
    })

    return {
      testFiles,
      redVerification: redResult,
    }
  }

  // All retries exhausted
  ctx.emitter.emit({
    type: 'phase:error',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'tdd', reason: lastError?.message ?? 'Unknown error' },
  })
  throw lastError ?? new Error('TDD phase failed')
}

// === Docs Phase (Spec 5 — FR-1 through FR-10) ===

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry } from '../../drivers/driver.js'
import type { DocsPhaseResult } from '../phase-results.js'
import { readPlanPhaseResult, readTddPhaseResult, readCodePhaseResult } from '../phase-results.js'
import { invokeAgentWithRetry } from '../retryable-agent.js'
import { buildDeliveryReportInput } from './report-builder.js'
import { buildIterationLog, renderIterationLog } from './iteration-log-builder.js'
import { generateFallbackReport } from './fallback-report.js'
import { buildDocWriterPrompt } from './docs-prompt.js'
import { commitSpecItem, markPrReady } from '../../git/git-operations.js'
import { spawnCommand } from '../../utils/process.js'

// === Constants ===

const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g
const MAX_PR_BODY_CHARS = 60_000

// === Helpers ===

function sanitizeOutput(text: string): string {
  return text.replace(CONTROL_CHARS_RE, '')
}

function verifyPathUnderProject(filePath: string, projectDir: string): void {
  const resolved = path.resolve(projectDir, filePath)
  if (!resolved.startsWith(path.resolve(projectDir) + path.sep)) {
    throw new Error(`Output path "${filePath}" is outside project directory`)
  }
}

// === API ===

export async function runDocsPhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  signal?: AbortSignal
): Promise<DocsPhaseResult> {
  const startTime = Date.now()

  // Guard abort — throw without fallback (FR-10)
  if (signal?.aborted) {
    ctx.emitter.emit({
      type: 'phase:error',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: 'docs', reason: 'Aborted' },
    })
    throw new Error('Docs phase aborted')
  }

  // Emit phase:start
  ctx.emitter.emit({
    type: 'phase:start',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'docs' },
  })

  // Load state and phase results
  const loadResult = ctx.state.load()
  if (!loadResult.found || !('valid' in loadResult) || !loadResult.valid) {
    throw new Error('Cannot load state for docs phase')
  }

  const state = loadResult.state
  const planResult = readPlanPhaseResult(state)
  const tddResult = readTddPhaseResult(state)
  const codeResult = readCodePhaseResult(state)

  if (!codeResult) {
    throw new Error('Missing code phase result — cannot generate docs')
  }

  // Build delivery report input
  const reportInput = buildDeliveryReportInput(ctx, planResult!, tddResult, codeResult)

  // Invoke doc writer agent with retry/fallback
  let reportContent = ''
  let usedFallback = false

  const prompt = buildDocWriterPrompt(reportInput)

  let agentSucceeded = false
  try {
    const result = await invokeAgentWithRetry({
      ctx,
      registry,
      role: 'docs',
      prompt,
      signal,
      onRetryableError: (retryResult) => {
        ctx.emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: ctx.sessionId,
          data: { role: 'docs', reason: `${retryResult.errorCode}: ${retryResult.error}` },
        })
      },
    })

    reportContent = sanitizeOutput(result.output)
    agentSucceeded = true
  } catch (err) {
    if (signal?.aborted) {
      throw new Error('Docs phase aborted')
    }
    process.stderr.write(`Warning: docs agent failed, using fallback report: ${(err as Error).message}\n`)
  }

  if (!agentSucceeded) {
    reportContent = generateFallbackReport(reportInput)
    usedFallback = true
  }

  // Build iteration log
  const events = ctx.emitter.getEvents()
  const iterationEntries = buildIterationLog(events, codeResult)
  const iterationContent = renderIterationLog(iterationEntries)

  // Verify output paths
  const deliveryReportPath = 'delivery-report.md'
  const iterationsLogPath = 'iterations.md'
  verifyPathUnderProject(deliveryReportPath, ctx.projectDir)
  verifyPathUnderProject(iterationsLogPath, ctx.projectDir)

  // Write files
  const absDeliveryPath = path.join(ctx.projectDir, deliveryReportPath)
  const absIterationsPath = path.join(ctx.projectDir, iterationsLogPath)
  fs.writeFileSync(absDeliveryPath, reportContent, 'utf-8')
  fs.writeFileSync(absIterationsPath, iterationContent, 'utf-8')

  // Commit doc files
  let commitHash: string | undefined
  try {
    commitHash = await commitSpecItem(ctx.projectDir, [deliveryReportPath, iterationsLogPath], 'docs(swarm): add delivery report and iteration log')
  } catch (err) {
    process.stderr.write(`Warning: doc commit failed: ${(err as Error).message}\n`)
  }

  // PR operations
  let prUpdated = false
  let prMarkedReady = false

  if (codeResult.gitState.prNumber) {
    const prNumber = codeResult.gitState.prNumber

    // Update PR body
    try {
      let prBody = reportContent
      if (prBody.length > MAX_PR_BODY_CHARS) {
        prBody = prBody.slice(0, MAX_PR_BODY_CHARS) + '\n\n...(truncated)'
      }

      await spawnCommand('gh', ['pr', 'edit', String(prNumber), '--body-file', '-'], {
        cwd: ctx.projectDir,
        timeoutMs: 30_000,
        stdin: prBody,
      })
      prUpdated = true
    } catch (err) {
      process.stderr.write(`Warning: PR body update failed: ${(err as Error).message}\n`)
    }

    // Mark PR ready
    try {
      await markPrReady(prNumber, ctx.projectDir)
      prMarkedReady = true
    } catch (err) {
      process.stderr.write(`Warning: mark PR ready failed: ${(err as Error).message}\n`)
    }
  }

  const result: DocsPhaseResult = {
    deliveryReportPath: absDeliveryPath,
    iterationsLogPath: absIterationsPath,
    commitHash,
    prUpdated,
    prMarkedReady,
    usedFallbackReport: usedFallback,
    success: true,
  }

  // Save state
  try {
    state.currentPhase = 'docs'
    state.completedPhases = [...state.completedPhases, 'docs']
    state.phaseResults = { ...state.phaseResults, docs: result }
    state.updatedAt = new Date().toISOString()
    ctx.state.save(state)
  } catch (err) {
    process.stderr.write(`Warning: state save failed: ${(err as Error).message}\n`)
  }

  // Emit phase:end
  ctx.emitter.emit({
    type: 'phase:end',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'docs', durationMs: Date.now() - startTime },
  })

  return result
}

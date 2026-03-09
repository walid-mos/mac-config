// === Docs Phase (Spec 5 — FR-1 through FR-10) ===

import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawn } from 'node:child_process'
import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry, AgentResult } from '../../drivers/driver.js'
import type { DocsPhaseResult } from '../phase-results.js'
import { readPlanPhaseResult, readTddPhaseResult, readCodePhaseResult } from '../phase-results.js'
import { buildDeliveryReportInput } from './report-builder.js'
import { buildIterationLog, renderIterationLog } from './iteration-log-builder.js'
import { generateFallbackReport } from './fallback-report.js'
import { buildDocWriterPrompt } from './docs-prompt.js'
import { commitSpecItem, markPrReady } from '../../git/git-operations.js'

// === Constants ===

const MAX_RETRIES = 2
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g
const MAX_PR_BODY_CHARS = 60_000

// === Helpers ===

function isRetryableErrorCode(code: string): boolean {
  return code === 'timeout' || code === 'crash' || code === 'empty_output' || code === 'invalid_json'
}

function isImmediateFailErrorCode(code: string): boolean {
  return code === 'aborted' || code === 'spawn_error'
}

function sanitizeOutput(text: string): string {
  return text.replace(CONTROL_CHARS_RE, '')
}

function verifyPathUnderProject(filePath: string, projectDir: string): void {
  const resolved = path.resolve(projectDir, filePath)
  if (!resolved.startsWith(path.resolve(projectDir) + path.sep)) {
    throw new Error(`Output path "${filePath}" is outside project directory`)
  }
}

function spawnWithTimeout(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  stdin?: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd })
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
    }, timeoutMs)

    if (stdin !== undefined && proc.stdin) {
      proc.stdin.write(stdin)
      proc.stdin.end()
    }

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        reject(new Error(`${cmd} timed out after ${timeoutMs}ms`))
      } else if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`${cmd} failed (exit ${code}): ${stderr || stdout}`))
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`${cmd} spawn error: ${err.message}`))
    })
  })
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
  let reportContent: string
  let usedFallback = false

  const { driver, model, agent } = registry.getDriver('docs')
  const prompt = buildDocWriterPrompt(reportInput)

  let agentSucceeded = false
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw new Error('Docs phase aborted')
    }

    const result: AgentResult = await driver.invoke({
      prompt,
      role: 'docs',
      agent,
      model,
      projectDir: ctx.projectDir,
      signal,
    })

    if (result.success) {
      reportContent = sanitizeOutput(result.output)
      agentSucceeded = true
      break
    }

    if (isImmediateFailErrorCode(result.errorCode)) {
      // Fallback immediately on spawn_error
      break
    }

    if (result.errorCode === 'aborted') {
      throw new Error('Docs phase aborted')
    }

    if (isRetryableErrorCode(result.errorCode) && attempt < MAX_RETRIES) {
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role: 'docs', reason: `${result.errorCode}: ${result.error}` },
      })
      continue
    }

    // All retries exhausted
    break
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
  fs.writeFileSync(absDeliveryPath, reportContent!, 'utf-8')
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
      let prBody = reportContent!
      if (prBody.length > MAX_PR_BODY_CHARS) {
        prBody = prBody.slice(0, MAX_PR_BODY_CHARS) + '\n\n...(truncated)'
      }

      await spawnWithTimeout(
        'gh', ['pr', 'edit', String(prNumber), '--body-file', '-'],
        ctx.projectDir, 30_000, prBody
      )
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

// === Docs Phase ===

import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawn } from 'node:child_process'
import { emitWarningEvent } from '../../core/event-emitter.js'
import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry } from '../../drivers/driver.js'
import type { DocsPhaseResult } from '../phase-results.js'
import { readPlanPhaseResult, readTddPhaseResult, readCodePhaseResult } from '../phase-results.js'
import { buildDeliveryReportInput } from './report-builder.js'
import { buildIterationLogArtifact, renderIterationLog } from './iteration-log-builder.js'
import { generateFallbackReport } from './fallback-report.js'
import { commitSpecItem, markPrReady } from '../../git/git-operations.js'

const MAX_PR_BODY_CHARS = 60_000

const verifyPathUnderProject = (filePath: string, projectDir: string): void => {
  const resolved = path.resolve(projectDir, filePath)
  if (!resolved.startsWith(path.resolve(projectDir) + path.sep)) {
    throw new Error(`Output path "${filePath}" is outside project directory`)
  }
}

const writeJsonFile = (filePath: string, value: unknown): void => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const spawnWithTimeout = (
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  stdin?: string
): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd })
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
        reject(new Error(`${command} timed out after ${timeoutMs}ms`))
        return
      }

      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(new Error(`${command} failed (exit ${code}): ${stderr || stdout}`))
    })

    proc.on('error', (error) => {
      clearTimeout(timer)
      reject(new Error(`${command} spawn error: ${error.message}`))
    })
  })
}

export const runDocsPhase = async (
  ctx: SessionContext,
  _registry: DriverRegistry,
  signal?: AbortSignal
): Promise<DocsPhaseResult> => {
  const startTime = Date.now()

  if (signal?.aborted) {
    ctx.emitter.emit({
      type: 'phase:error',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: 'docs', reason: 'Aborted' },
    })
    throw new Error('Docs phase aborted')
  }

  ctx.emitter.emit({
    type: 'phase:start',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'docs' },
  })

  const loadResult = ctx.state.load()
  if (!loadResult.found || !('valid' in loadResult) || !loadResult.valid) {
    throw new Error('Cannot load state for docs phase')
  }

  const state = loadResult.state
  const planResult = readPlanPhaseResult(state)
  const tddResult = readTddPhaseResult(state)
  const codeResult = readCodePhaseResult(state)

  if (!planResult) {
    throw new Error('Missing plan phase result - cannot generate docs')
  }

  if (!codeResult) {
    throw new Error('Missing code phase result - cannot generate docs')
  }

  const deliveryReport = buildDeliveryReportInput(ctx, planResult, tddResult, codeResult)
  const iterationLog = buildIterationLogArtifact(
    ctx.sessionId,
    ctx.emitter.getEvents(),
    codeResult,
    deliveryReport.completedAt
  )
  const deliveryMarkdown = generateFallbackReport(deliveryReport)
  const iterationMarkdown = renderIterationLog(iterationLog)

  const artifactDir = path.join('.swarm', 'artifacts', ctx.sessionId)
  fs.mkdirSync(path.join(ctx.projectDir, artifactDir), { recursive: true })

  const deliveryReportJsonPath = path.join(artifactDir, 'delivery-report.json')
  const deliveryReportMarkdownPath = path.join(artifactDir, 'delivery-report.md')
  const iterationLogJsonPath = path.join(artifactDir, 'iterations.json')
  const iterationLogMarkdownPath = path.join(artifactDir, 'iterations.md')

  for (const artifactPath of [
    deliveryReportJsonPath,
    deliveryReportMarkdownPath,
    iterationLogJsonPath,
    iterationLogMarkdownPath,
  ]) {
    verifyPathUnderProject(artifactPath, ctx.projectDir)
  }

  writeJsonFile(path.join(ctx.projectDir, deliveryReportJsonPath), deliveryReport)
  fs.writeFileSync(path.join(ctx.projectDir, deliveryReportMarkdownPath), deliveryMarkdown, 'utf-8')
  writeJsonFile(path.join(ctx.projectDir, iterationLogJsonPath), iterationLog)
  fs.writeFileSync(path.join(ctx.projectDir, iterationLogMarkdownPath), iterationMarkdown, 'utf-8')

  for (const artifactPath of [
    deliveryReportJsonPath,
    deliveryReportMarkdownPath,
    iterationLogJsonPath,
    iterationLogMarkdownPath,
  ]) {
    ctx.emitter.emit({
      type: 'file:changed',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { path: artifactPath, action: 'modified' },
    })
  }

  let commitHash: string | undefined
  try {
    commitHash = await commitSpecItem(
      ctx.projectDir,
      [
        deliveryReportJsonPath,
        deliveryReportMarkdownPath,
        iterationLogJsonPath,
        iterationLogMarkdownPath,
      ],
      'docs(swarm): add delivery report artifacts'
    )
  } catch (error) {
    const message = `Warning: doc commit failed: ${(error as Error).message}`
    process.stderr.write(`${message}\n`)
    emitWarningEvent(ctx.emitter, ctx.sessionId, 'docs.commit', message)
  }

  if (codeResult.gitState.prNumber) {
    try {
      let prBody = deliveryMarkdown
      if (prBody.length > MAX_PR_BODY_CHARS) {
        prBody = `${prBody.slice(0, MAX_PR_BODY_CHARS)}\n\n...(truncated)`
      }

      await spawnWithTimeout(
        'gh',
        ['pr', 'edit', String(codeResult.gitState.prNumber), '--body-file', '-'],
        ctx.projectDir,
        30_000,
        prBody
      )
    } catch (error) {
      const message = `Warning: PR body update failed: ${(error as Error).message}`
      process.stderr.write(`${message}\n`)
      emitWarningEvent(ctx.emitter, ctx.sessionId, 'docs.pr-body', message)
    }

    try {
      await markPrReady(codeResult.gitState.prNumber, ctx.projectDir)
    } catch (error) {
      const message = `Warning: mark PR ready failed: ${(error as Error).message}`
      process.stderr.write(`${message}\n`)
      emitWarningEvent(ctx.emitter, ctx.sessionId, 'docs.pr-ready', message)
    }
  }

  const result: DocsPhaseResult = {
    deliveryReportJsonPath: path.join(ctx.projectDir, deliveryReportJsonPath),
    deliveryReportMarkdownPath: path.join(ctx.projectDir, deliveryReportMarkdownPath),
    iterationLogJsonPath: path.join(ctx.projectDir, iterationLogJsonPath),
    iterationLogMarkdownPath: path.join(ctx.projectDir, iterationLogMarkdownPath),
    commitHash,
    success: true,
  }

  try {
    state.currentPhase = 'docs'
    state.completedPhases = [...state.completedPhases, 'docs']
    state.phaseResults = { ...state.phaseResults, docs: result }
    state.updatedAt = new Date().toISOString()
    ctx.state.save(state)
  } catch (error) {
    const message = `Warning: state save failed: ${(error as Error).message}`
    process.stderr.write(`${message}\n`)
    emitWarningEvent(ctx.emitter, ctx.sessionId, 'docs.state-save', message)
  }

  ctx.emitter.emit({
    type: 'phase:end',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: 'docs', durationMs: Date.now() - startTime },
  })

  return result
}

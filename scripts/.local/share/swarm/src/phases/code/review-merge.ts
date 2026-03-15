// === Review & Merge Orchestration (Spec 4 — FR-6, FR-7) ===

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry, AgentResult } from '../../drivers/driver.js'
import type { TestResult, MergedReview, ReviewFinding, IterationState } from '../phase-results.js'
import { invokeAgentWithRetry } from '../retryable-agent.js'
import { buildReviewPrompt } from './review-prompt.js'
import { buildSecurityPrompt } from './security-prompt.js'
import { buildConsistencyPrompt } from './consistency-prompt.js'
import { buildMergePrompt } from './merge-prompt.js'
import { parseStructuredOutput } from '../../drivers/output-parser.js'
import { spawnGit } from '../../utils/process.js'

// === Constants ===

const SENSITIVE_PATTERNS = [/^\.env($|\.)/, /\.pem$/, /\.key$/]
const DECISION_LOG_RELATIVE = '.swarm/review-decision-log.md'


// === Helpers ===

function filterSensitiveFiles(files: string[]): string[] {
  return files.filter(f => {
    const basename = f.split('/').pop() ?? f
    return !SENSITIVE_PATTERNS.some(p => p.test(basename))
  })
}

function writeDecisionLog(projectDir: string, decisionLog: string): string | undefined {
  if (!decisionLog) return undefined
  const logPath = join(projectDir, DECISION_LOG_RELATIVE)
  mkdirSync(dirname(logPath), { recursive: true })
  writeFileSync(logPath, decisionLog, 'utf-8')
  return logPath
}

function parseReviewFindings(output: string): ReviewFinding[] {
  // Agent output may be wrapped in ```json fences — parseStructuredOutput strips them
  const cleaned = parseStructuredOutput(output)
  if (!cleaned.ok) {
    process.stderr.write(`WARNING: Failed to parse review findings: no valid JSON found\n`)
    process.stderr.write(`Raw output (first 200 chars): ${output.slice(0, 200)}\n`)
    return []
  }

  try {
    const parsed = JSON.parse(cleaned.output) as { findings?: ReviewFinding[] }
    return parsed.findings ?? []
  } catch (err) {
    process.stderr.write(`WARNING: Failed to parse review findings JSON: ${(err as Error).message}\n`)
    process.stderr.write(`Raw output (first 200 chars): ${output.slice(0, 200)}\n`)
    return []
  }
}

function parseMergedReview(output: string): MergedReview {
  // Agent output may be wrapped in ```json fences — parseStructuredOutput strips them
  const cleaned = parseStructuredOutput(output)
  if (!cleaned.ok) {
    process.stderr.write(`WARNING: Failed to parse merged review: no valid JSON found\n`)
    process.stderr.write(`Raw output (first 200 chars): ${output.slice(0, 200)}\n`)
    return { findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0 }
  }

  try {
    const parsed = JSON.parse(cleaned.output) as MergedReview & { convergenceRecommendation?: string }
    return {
      findings: parsed.findings ?? [],
      criticalCount: parsed.criticalCount ?? 0,
      importantCount: parsed.importantCount ?? 0,
      suggestionCount: parsed.suggestionCount ?? 0,
      convergenceRecommendation: parsed.convergenceRecommendation === 'converged' ? 'converged' : 'continue',
    }
  } catch (err) {
    process.stderr.write(`WARNING: Failed to parse merged review JSON: ${(err as Error).message}\n`)
    process.stderr.write(`Raw output (first 200 chars): ${output.slice(0, 200)}\n`)
    return { findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0 }
  }
}

async function invokeWithRetry(
  ctx: SessionContext,
  registry: DriverRegistry,
  role: 'review' | 'security' | 'consistency' | 'merge',
  prompt: string,
  signal?: AbortSignal
): Promise<AgentResult> {
  return invokeAgentWithRetry({
    ctx,
    registry,
    role,
    prompt,
    signal,
    onRetryableError: (result) => {
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role, reason: `${result.errorCode}: ${result.error}` },
      })
    },
    onImmediateFailure: (result) => {
      throw new Error(`${role} review failed: ${result.errorCode}: ${result.error}`)
    },
    onExhausted: (result, attempt) => {
      throw new Error(`${role} review failed after ${attempt + 1} attempts: ${result.errorCode}`)
    },
  })
}

// === Trajectory ===

export function buildFindingTrajectory(iterations: IterationState[]): string {
  return iterations
    .map((iter) => {
      const review = 'review' in iter.outcome ? iter.outcome.review : undefined
      if (!review) return `Wave ${iter.iteration}: (no review)`
      return `Wave ${iter.iteration}: ${review.criticalCount} critical, ${review.importantCount} important, ${review.suggestionCount} suggestion${review.suggestionCount !== 1 ? 's' : ''}`
    })
    .join('\n')
}

// === API ===

export async function runReviewPhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  changedFiles: string[],
  testResult: TestResult,
  signal?: AbortSignal,
  decisionLog: string = '',
  iterationIndex: number = 0,
  iterations: IterationState[] = []
): Promise<MergedReview> {
  if (signal?.aborted) {
    throw new Error('Review phase aborted')
  }

  // Filter sensitive files
  const safeFiles = filterSensitiveFiles(changedFiles)

  // Intent-to-add new files so agents' `git diff HEAD` sees them
  if (safeFiles.length > 0) {
    try {
      await spawnGit(['add', '-N', '--', ...safeFiles], ctx.projectDir)
    } catch (err) {
      process.stderr.write(`WARNING: git add -N failed: ${(err as Error).message}\n`)
    }
  }

  // Write decision log to file (if non-empty) so agents can read it
  const decisionLogPath = writeDecisionLog(ctx.projectDir, decisionLog)

  // Build prompts — agents read diff, spec, and project context themselves
  const promptOpts = {
    changedFiles: safeFiles,
    specPath: ctx.specPath,
    testResult,
    decisionLogPath,
    iterationIndex,
  }
  const reviewPrompt = buildReviewPrompt(promptOpts)
  const securityPromptText = buildSecurityPrompt(promptOpts)
  const consistencyPromptText = buildConsistencyPrompt(promptOpts)

  // Run code + security + consistency review in parallel
  const [codeReviewResult, securityReviewResult, consistencyResult] = await Promise.all([
    invokeWithRetry(ctx, registry, 'review', reviewPrompt, signal),
    invokeWithRetry(ctx, registry, 'security', securityPromptText, signal),
    invokeWithRetry(ctx, registry, 'consistency', consistencyPromptText, signal),
  ])

  // invokeWithRetry throws on failure, so these are guaranteed to be success results
  const codeOutput = codeReviewResult.success ? codeReviewResult.output : ''
  const secOutput = securityReviewResult.success ? securityReviewResult.output : ''
  const consistencyOutput = consistencyResult.success ? consistencyResult.output : ''

  const codeFindings = parseReviewFindings(codeOutput)
  const securityFindings = parseReviewFindings(secOutput)
  const consistencyFindings = parseReviewFindings(consistencyOutput)

  // Build merge prompt and invoke merge agent
  const trajectory = buildFindingTrajectory(iterations)
  const mergePrompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings], iterationIndex, decisionLog, trajectory)
  const mergeResult = await invokeWithRetry(ctx, registry, 'merge', mergePrompt, signal)
  const mergeOutput = mergeResult.success ? mergeResult.output : ''

  let merged = parseMergedReview(mergeOutput)

  // Verify merge integrity — restore dropped critical findings
  const { restored, warnings } = verifyMergeIntegrity(codeFindings, securityFindings, consistencyFindings, merged.findings)
  if (restored.length > 0) {
    merged = {
      findings: [...merged.findings, ...restored],
      criticalCount: merged.criticalCount + restored.filter(f => f.severity === 'critical').length,
      importantCount: merged.importantCount + restored.filter(f => f.severity === 'important').length,
      suggestionCount: merged.suggestionCount + restored.filter(f => f.severity === 'suggestion').length,
    }
    for (const warning of warnings) {
      process.stderr.write(`${warning}\n`)
    }
  }

  // Emit review:findings event
  ctx.emitter.emit({
    type: 'review:findings',
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    data: {
      critical: merged.criticalCount,
      important: merged.importantCount,
      suggestion: merged.suggestionCount,
    },
  })

  return merged
}

export function verifyMergeIntegrity(
  codeReviewFindings: ReviewFinding[],
  securityFindings: ReviewFinding[],
  consistencyFindings: ReviewFinding[],
  mergedFindings: ReviewFinding[]
): { restored: ReviewFinding[]; warnings: string[] } {
  // Collect all critical findings from all three inputs
  const allCritical = [
    ...codeReviewFindings.filter(f => f.severity === 'critical'),
    ...securityFindings.filter(f => f.severity === 'critical'),
    ...consistencyFindings.filter(f => f.severity === 'critical'),
  ]

  const restored: ReviewFinding[] = []
  const warnings: string[] = []

  for (const critical of allCritical) {
    // Check if present in merged (match by file + line + category)
    const found = mergedFindings.some(m =>
      m.file === critical.file &&
      m.line === critical.line &&
      m.category === critical.category
    )

    if (!found) {
      restored.push(critical)
      warnings.push(
        `Critical finding dropped by merge agent: ${critical.file}:${critical.line ?? '?'} [${critical.category}] — restored`
      )
    }
  }

  return { restored, warnings }
}

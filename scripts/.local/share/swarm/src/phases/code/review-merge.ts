// === Review & Merge Orchestration (Spec 4 — FR-6, FR-7) ===

import { spawn } from 'node:child_process'
import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry, AgentResult } from '../../drivers/driver.js'
import type { TestResult, MergedReview, ReviewFinding, IterationState } from '../phase-results.js'
import { buildReviewPrompt } from './review-prompt.js'
import { buildSecurityPrompt } from './security-prompt.js'
import { buildConsistencyPrompt } from './consistency-prompt.js'
import { buildMergePrompt } from './merge-prompt.js'
import { readProjectContext, type ProjectContext } from '../../detect/tech-stack.js'
import { parseStructuredOutput } from '../../drivers/output-parser.js'

// === Constants ===

const MAX_SPEC_CONTEXT_BYTES = 4096 // 4KB
const MAX_RETRIES = 2
const SENSITIVE_PATTERNS = [/^\.env($|\.)/, /\.pem$/, /\.key$/]


// === Helpers ===

function isRetryableErrorCode(code: string): boolean {
  return code === 'timeout' || code === 'crash' || code === 'empty_output' || code === 'invalid_json'
}

function isImmediateFailErrorCode(code: string): boolean {
  return code === 'aborted' || code === 'spawn_error'
}

function filterSensitiveFiles(files: string[]): string[] {
  return files.filter(f => {
    const basename = f.split('/').pop() ?? f
    return !SENSITIVE_PATTERNS.some(p => p.test(basename))
  })
}

function truncateSpec(spec: string): string {
  if (Buffer.byteLength(spec, 'utf-8') <= MAX_SPEC_CONTEXT_BYTES) return spec
  return Buffer.from(spec, 'utf-8').subarray(0, MAX_SPEC_CONTEXT_BYTES).toString('utf-8')
}

function spawnGit(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd })
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`git ${args[0]} failed (exit ${code}): ${stderr || stdout}`))
      }
    })
    proc.on('error', (err) => {
      reject(new Error(`git spawn error: ${err.message}`))
    })
  })
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
  const { driver, model, agent } = registry.getDriver(role)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw new Error(`${role} review aborted`)
    }

    const result = await driver.invoke({
      prompt,
      role,
      agent,
      model,
      projectDir: ctx.projectDir,
      signal,
    })

    if (result.success) return result

    if (isImmediateFailErrorCode(result.errorCode)) {
      throw new Error(`${role} review failed: ${result.errorCode}: ${result.error}`)
    }

    if (isRetryableErrorCode(result.errorCode) && attempt < MAX_RETRIES) {
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role, reason: `${result.errorCode}: ${result.error}` },
      })
      continue
    }

    throw new Error(`${role} review failed after ${attempt + 1} attempts: ${result.errorCode}`)
  }

  throw new Error(`${role} review failed: all retries exhausted`)
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
  specItemContext: string,
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

  // Truncate spec context
  const truncatedSpec = truncateSpec(specItemContext)

  // Get git diff — intent-to-add new files first so they appear in the diff.
  // Without this, new untracked files created by code agents are invisible to git diff HEAD.
  let diff = ''
  if (safeFiles.length > 0) {
    try {
      await spawnGit(['add', '-N', '--', ...safeFiles], ctx.projectDir)
    } catch (err) {
      process.stderr.write(`WARNING: git add -N failed: ${(err as Error).message}\n`)
    }
    try {
      const result = await spawnGit(['diff', 'HEAD', '--', ...safeFiles], ctx.projectDir)
      diff = result.stdout
    } catch (err) {
      process.stderr.write(`WARNING: git diff failed, review will run on empty diff: ${(err as Error).message}\n`)
      diff = '(diff unavailable)'
    }
  }

  // Read project context (non-fatal)
  let projectContext: ProjectContext | undefined
  try {
    projectContext = await readProjectContext(ctx.projectDir)
  } catch (err) {
    process.stderr.write(`WARNING: readProjectContext failed: ${(err as Error).message}\n`)
  }

  // Build prompts
  const reviewPrompt = buildReviewPrompt(diff, truncatedSpec, testResult, projectContext, decisionLog, iterationIndex)
  const securityPromptText = buildSecurityPrompt(diff, truncatedSpec, testResult, projectContext, decisionLog, iterationIndex)
  const consistencyPromptText = buildConsistencyPrompt(diff, safeFiles, truncatedSpec, testResult, projectContext, decisionLog, iterationIndex)

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

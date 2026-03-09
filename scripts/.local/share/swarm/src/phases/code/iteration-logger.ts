// === Iteration Logger (Per-iteration session logs) ===

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MergedReview, ReviewFinding, TestResult, BuildResult } from '../phase-results.js'

// === Types ===

export interface IterationSummary {
  waveIndex: number
  attempt: number
  status: 'green' | 'needs-iteration' | 'exhausted'
  reason?: 'review-findings'
  criticalCount?: number
  testResult?: TestResult
  buildResult?: BuildResult
}

export interface IterationLogger {
  readonly sessionDir: string
  logAgentPrompt(waveIndex: number, attempt: number, taskId: string, prompt: string): void
  logAgentResult(waveIndex: number, attempt: number, taskId: string, result: string): void
  logReview(waveIndex: number, attempt: number, review: MergedReview): void
  logTestResult(waveIndex: number, attempt: number, testResult: TestResult): void
  logBuildResult(waveIndex: number, attempt: number, buildResult: BuildResult): void
  logIterationSummary(waveIndex: number, attempt: number, summary: IterationSummary): void
}

// === Helpers ===

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

function attemptDir(sessionDir: string, waveIndex: number, attempt: number): string {
  return join(sessionDir, `wave-${waveIndex}`, `attempt-${attempt}`)
}

function buildSummaryMarkdown(summary: IterationSummary): string {
  const lines: string[] = [
    `# Iteration Summary`,
    '',
    `- **Wave:** ${summary.waveIndex}`,
    `- **Attempt:** ${summary.attempt}`,
    `- **Status:** ${summary.status}`,
  ]

  if (summary.reason) {
    lines.push(`- **Reason:** ${summary.reason}`)
  }

  if (summary.criticalCount !== undefined) {
    lines.push(`- **Critical findings:** ${summary.criticalCount}`)
  }

  if (summary.testResult) {
    lines.push('')
    lines.push('## Test Results')
    lines.push(`- Total: ${summary.testResult.totalTests}`)
    lines.push(`- Passing: ${summary.testResult.passingTests}`)
    lines.push(`- Failing: ${summary.testResult.failingTests}`)
    lines.push(`- Duration: ${summary.testResult.durationMs}ms`)
  }

  if (summary.buildResult) {
    lines.push('')
    lines.push('## Build Results')
    lines.push(`- Success: ${summary.buildResult.success}`)
    lines.push(`- Duration: ${summary.buildResult.durationMs}ms`)
  }

  lines.push('')
  return lines.join('\n')
}

// === API ===

export function createIterationLogger(projectDir: string, sessionId: string): IterationLogger {
  const sessionDir = join(projectDir, '.swarm', 'sessions', sessionId)
  ensureDir(sessionDir)

  return {
    sessionDir,

    logAgentPrompt(waveIndex, attempt, taskId, prompt) {
      const dir = attemptDir(sessionDir, waveIndex, attempt)
      ensureDir(dir)
      writeFileSync(join(dir, `agent-${taskId}-prompt.md`), prompt, 'utf-8')
    },

    logAgentResult(waveIndex, attempt, taskId, result) {
      const dir = attemptDir(sessionDir, waveIndex, attempt)
      ensureDir(dir)
      writeFileSync(join(dir, `agent-${taskId}.md`), result, 'utf-8')
    },

    logReview(waveIndex, attempt, review) {
      const dir = attemptDir(sessionDir, waveIndex, attempt)
      ensureDir(dir)
      writeFileSync(join(dir, 'merged-review.json'), JSON.stringify(review, null, 2), 'utf-8')
    },

    logTestResult(waveIndex, attempt, testResult) {
      const dir = attemptDir(sessionDir, waveIndex, attempt)
      ensureDir(dir)
      writeFileSync(join(dir, 'test-result.json'), JSON.stringify(testResult, null, 2), 'utf-8')
    },

    logBuildResult(waveIndex, attempt, buildResult) {
      const dir = attemptDir(sessionDir, waveIndex, attempt)
      ensureDir(dir)
      writeFileSync(join(dir, 'build-result.json'), JSON.stringify(buildResult, null, 2), 'utf-8')
    },

    logIterationSummary(waveIndex, attempt, summary) {
      const dir = attemptDir(sessionDir, waveIndex, attempt)
      ensureDir(dir)
      writeFileSync(join(dir, 'summary.md'), buildSummaryMarkdown(summary), 'utf-8')
    },
  }
}

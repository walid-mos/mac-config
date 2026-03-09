import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createIterationLogger } from '../../../src/phases/code/iteration-logger.js'
import type { MergedReview, TestResult, BuildResult } from '../../../src/phases/phase-results.js'

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'swarm-logger-test-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createIterationLogger', () => {
  it('creates the session directory on init', () => {
    const logger = createIterationLogger(tempDir, 'sess-001')

    expect(existsSync(logger.sessionDir)).toBe(true)
    expect(logger.sessionDir).toBe(join(tempDir, '.swarm', 'sessions', 'sess-001'))
  })

  it('logAgentPrompt writes prompt file', () => {
    const logger = createIterationLogger(tempDir, 'sess-002')
    logger.logAgentPrompt(0, 0, 'TASK-1', 'Implement the feature')

    const path = join(logger.sessionDir, 'wave-0', 'attempt-0', 'agent-TASK-1-prompt.md')
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path, 'utf-8')).toBe('Implement the feature')
  })

  it('logAgentResult writes result file', () => {
    const logger = createIterationLogger(tempDir, 'sess-003')
    logger.logAgentResult(1, 2, 'TASK-3', 'Modified src/index.ts')

    const path = join(logger.sessionDir, 'wave-1', 'attempt-2', 'agent-TASK-3.md')
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path, 'utf-8')).toBe('Modified src/index.ts')
  })

  it('logReview writes merged-review.json', () => {
    const logger = createIterationLogger(tempDir, 'sess-004')
    const review: MergedReview = {
      findings: [{ file: 'a.ts', severity: 'critical', category: 'bug', description: 'NPE' }],
      criticalCount: 1,
      importantCount: 0,
      suggestionCount: 0,
    }
    logger.logReview(0, 0, review)

    const path = join(logger.sessionDir, 'wave-0', 'attempt-0', 'merged-review.json')
    expect(existsSync(path)).toBe(true)
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    expect(parsed.criticalCount).toBe(1)
    expect(parsed.findings).toHaveLength(1)
  })

  it('logTestResult writes test-result.json', () => {
    const logger = createIterationLogger(tempDir, 'sess-005')
    const testResult: TestResult = {
      totalTests: 10,
      passingTests: 8,
      failingTests: 2,
      durationMs: 1500,
    }
    logger.logTestResult(0, 1, testResult)

    const path = join(logger.sessionDir, 'wave-0', 'attempt-1', 'test-result.json')
    expect(existsSync(path)).toBe(true)
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    expect(parsed.failingTests).toBe(2)
  })

  it('logBuildResult writes build-result.json', () => {
    const logger = createIterationLogger(tempDir, 'sess-006')
    const buildResult: BuildResult = {
      success: false,
      output: 'Type error in src/main.ts',
      durationMs: 3000,
    }
    logger.logBuildResult(0, 0, buildResult)

    const path = join(logger.sessionDir, 'wave-0', 'attempt-0', 'build-result.json')
    expect(existsSync(path)).toBe(true)
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    expect(parsed.success).toBe(false)
    expect(parsed.output).toContain('Type error')
  })

  it('logIterationSummary writes summary.md with correct content', () => {
    const logger = createIterationLogger(tempDir, 'sess-007')
    logger.logIterationSummary(0, 0, {
      waveIndex: 0,
      attempt: 0,
      status: 'needs-iteration',
      reason: 'tests-failing',
      criticalCount: 2,
      testResult: { totalTests: 10, passingTests: 7, failingTests: 3, durationMs: 2000 },
      buildResult: { success: true, output: '', durationMs: 1000 },
    })

    const path = join(logger.sessionDir, 'wave-0', 'attempt-0', 'summary.md')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('# Iteration Summary')
    expect(content).toContain('**Status:** needs-iteration')
    expect(content).toContain('**Reason:** tests-failing')
    expect(content).toContain('**Critical findings:** 2')
    expect(content).toContain('Failing: 3')
    expect(content).toContain('## Build Results')
  })

  it('creates correct directory structure across multiple waves and attempts', () => {
    const logger = createIterationLogger(tempDir, 'sess-008')

    logger.logAgentPrompt(0, 0, 'TASK-1', 'prompt1')
    logger.logAgentPrompt(0, 1, 'TASK-1', 'prompt2')
    logger.logAgentPrompt(1, 0, 'TASK-2', 'prompt3')

    expect(existsSync(join(logger.sessionDir, 'wave-0', 'attempt-0', 'agent-TASK-1-prompt.md'))).toBe(true)
    expect(existsSync(join(logger.sessionDir, 'wave-0', 'attempt-1', 'agent-TASK-1-prompt.md'))).toBe(true)
    expect(existsSync(join(logger.sessionDir, 'wave-1', 'attempt-0', 'agent-TASK-2-prompt.md'))).toBe(true)
  })

  it('overwrites files on repeated calls to the same attempt', () => {
    const logger = createIterationLogger(tempDir, 'sess-009')
    logger.logAgentPrompt(0, 0, 'TASK-1', 'first')
    logger.logAgentPrompt(0, 0, 'TASK-1', 'second')

    const path = join(logger.sessionDir, 'wave-0', 'attempt-0', 'agent-TASK-1-prompt.md')
    expect(readFileSync(path, 'utf-8')).toBe('second')
  })
})

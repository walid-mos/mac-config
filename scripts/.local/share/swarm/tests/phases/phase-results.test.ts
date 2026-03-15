import { describe, it, expect } from 'vitest'
import {
  readPlanPhaseResult,
  readTddPhaseResult,
  readCodePhaseResult,
  readDocsPhaseResult,
  deliveryReportInputSchema,
  iterationLogEntrySchema,
  docsPhaseResultSchema,
  agentInvocationRecordSchema,
} from '../../src/phases/phase-results.js'
import type { PlanPhaseResult, TddPhaseResult, CodePhaseResult, DocsPhaseResult } from '../../src/phases/phase-results.js'
import { createSwarmState } from '../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createValidPlanPhaseResult(): PlanPhaseResult {
  return {
    plannerOutput: '## Task Decomposition\n### TASK-1: Feature\n...',
    tasks: [
      {
        id: 'TASK-1' as `TASK-${number}`,
        title: 'Implement feature',
        description: 'Feature implementation',
        tag: 'backend',
        dependencies: [],
        testHints: ['test feature behavior'],
      },
    ],
    techStack: {
      languages: ['typescript'],
      frameworks: ['react'],
      testRunner: 'vitest',
      packageManager: 'pnpm',
      buildTool: 'vite',
      configFiles: ['tsconfig.json'],
      testCommand: 'pnpm exec vitest run',
      buildCommand: null,
      typecheckCommand: null,
      lintCommand: null,
    },
    taskCount: 1,
    tags: { backend: 1 },
  }
}

function createValidTddPhaseResult(): TddPhaseResult {
  return {
    testFiles: ['tests/feature.test.ts'],
    agentReport: {
      testFiles: ['tests/feature.test.ts'],
      testResult: { totalTests: 5, passingTests: 0, failingTests: 5, durationMs: 300 },
      isRed: true,
    },
  }
}

// ---------------------------------------------------------------------------
// readPlanPhaseResult
// ---------------------------------------------------------------------------

describe('readPlanPhaseResult', () => {
  it('returns null when phaseResults.plan is absent', () => {
    const state = createSwarmState({ phaseResults: {} })

    const result = readPlanPhaseResult(state)

    expect(result).toBeNull()
  })

  it('returns validated PlanPhaseResult when present', () => {
    const planResult = createValidPlanPhaseResult()
    const state = createSwarmState({
      phaseResults: { plan: planResult },
    })

    const result = readPlanPhaseResult(state)

    expect(result).not.toBeNull()
    expect(result!.plannerOutput).toBe(planResult.plannerOutput)
    expect(result!.tasks).toHaveLength(1)
    expect(result!.taskCount).toBe(1)
  })

  it('throws on structurally invalid data', () => {
    const state = createSwarmState({
      phaseResults: { plan: { invalid: 'structure' } },
    })

    expect(() => readPlanPhaseResult(state)).toThrow()
  })

  it('validates PlanPhaseResult has plannerOutput, tasks, techStack, taskCount, tags', () => {
    const planResult = createValidPlanPhaseResult()
    const state = createSwarmState({
      phaseResults: { plan: planResult },
    })

    const result = readPlanPhaseResult(state)

    expect(result).toHaveProperty('plannerOutput')
    expect(result).toHaveProperty('tasks')
    expect(result).toHaveProperty('techStack')
    expect(result).toHaveProperty('taskCount')
    expect(result).toHaveProperty('tags')
  })

  it('validates TechStack shape within PlanPhaseResult', () => {
    const planResult = createValidPlanPhaseResult()
    const state = createSwarmState({
      phaseResults: { plan: planResult },
    })

    const result = readPlanPhaseResult(state)

    const ts = result!.techStack
    expect(ts).toHaveProperty('languages')
    expect(ts).toHaveProperty('frameworks')
    expect(ts).toHaveProperty('testRunner')
    expect(ts).toHaveProperty('packageManager')
    expect(ts).toHaveProperty('buildTool')
    expect(ts).toHaveProperty('configFiles')
    expect(ts).toHaveProperty('testCommand')
  })

  it('validates PlannerTask shape within PlanPhaseResult.tasks', () => {
    const planResult = createValidPlanPhaseResult()
    const state = createSwarmState({
      phaseResults: { plan: planResult },
    })

    const result = readPlanPhaseResult(state)

    const task = result!.tasks[0]!
    expect(task).toHaveProperty('id')
    expect(task).toHaveProperty('title')
    expect(task).toHaveProperty('description')
    expect(task).toHaveProperty('tag')
    expect(task).toHaveProperty('dependencies')
    expect(task).toHaveProperty('testHints')
  })
})

// ---------------------------------------------------------------------------
// readTddPhaseResult
// ---------------------------------------------------------------------------

describe('readTddPhaseResult', () => {
  it('returns null when phaseResults.tdd is absent', () => {
    const state = createSwarmState({ phaseResults: {} })

    const result = readTddPhaseResult(state)

    expect(result).toBeNull()
  })

  it('returns validated TddPhaseResult when present', () => {
    const tddResult = createValidTddPhaseResult()
    const state = createSwarmState({
      phaseResults: { tdd: tddResult },
    })

    const result = readTddPhaseResult(state)

    expect(result).not.toBeNull()
    expect(result!.testFiles).toEqual(tddResult.testFiles)
    expect(result!.agentReport.isRed).toBe(true)
  })

  it('throws on structurally invalid data', () => {
    const state = createSwarmState({
      phaseResults: { tdd: { notValid: true } },
    })

    expect(() => readTddPhaseResult(state)).toThrow()
  })

  it('validates TddPhaseResult has testFiles and agentReport', () => {
    const tddResult = createValidTddPhaseResult()
    const state = createSwarmState({
      phaseResults: { tdd: tddResult },
    })

    const result = readTddPhaseResult(state)

    expect(result).toHaveProperty('testFiles')
    expect(result).toHaveProperty('agentReport')
  })

  it('validates TddAgentOutput shape in TddPhaseResult', () => {
    const tddResult = createValidTddPhaseResult()
    const state = createSwarmState({
      phaseResults: { tdd: tddResult },
    })

    const result = readTddPhaseResult(state)

    const report = result!.agentReport
    expect(report).toHaveProperty('testFiles')
    expect(report).toHaveProperty('testResult')
    expect(report).toHaveProperty('isRed')
    expect(report.testResult).toHaveProperty('totalTests')
    expect(report.testResult).toHaveProperty('passingTests')
    expect(report.testResult).toHaveProperty('failingTests')
  })
})

// ---------------------------------------------------------------------------
// Helpers for Spec 4 (CodePhaseResult)
// ---------------------------------------------------------------------------

function createValidCodePhaseResult(): CodePhaseResult {
  return {
    waves: [
      {
        waveIndex: 0,
        tasks: [
          {
            id: 'TASK-1' as `TASK-${number}`,
            title: 'Implement feature',
            description: 'Feature implementation',
            tag: 'backend',
            files: ['src/feature.ts'],
            dependencies: [],
            testHints: ['test feature behavior'],
          },
        ],
      },
    ],
    iterations: [
      {
        iteration: 1,
        outcome: {
          status: 'green',
          testResult: { totalTests: 5, passingTests: 5, failingTests: 0, durationMs: 1200 },
          review: { findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0 },
        },
        changedFiles: ['src/feature.ts'],
      },
    ],
    finalTestResult: { totalTests: 5, passingTests: 5, failingTests: 0, durationMs: 1200 },
    finalReview: { findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0 },
    gitState: {
      branch: 'feat/test-session',
      prNumber: 42,
      prUrl: 'https://github.com/org/repo/pull/42',
      commits: [
        { hash: 'abc1234', message: 'feat: implement feature', specItem: 'TASK-1', iteration: 1 },
      ],
    },
    changedFiles: ['src/feature.ts'],
    success: true,
    terminalStatus: 'green',
  }
}

// ---------------------------------------------------------------------------
// readCodePhaseResult
// ---------------------------------------------------------------------------

describe('readCodePhaseResult', () => {
  it('returns null when phaseResults.code is absent', () => {
    const state = createSwarmState({ phaseResults: {} })

    const result = readCodePhaseResult(state)

    expect(result).toBeNull()
  })

  it('returns validated CodePhaseResult when present', () => {
    const codeResult = createValidCodePhaseResult()
    const state = createSwarmState({
      phaseResults: { code: codeResult },
    })

    const result = readCodePhaseResult(state)

    expect(result).not.toBeNull()
    expect(result!.success).toBe(true)
    expect(result!.terminalStatus).toBe('green')
    expect(result!.waves).toHaveLength(1)
    expect(result!.iterations).toHaveLength(1)
  })

  it('throws on structurally invalid data', () => {
    const state = createSwarmState({
      phaseResults: { code: { invalid: 'structure' } },
    })

    expect(() => readCodePhaseResult(state)).toThrow()
  })

  it('validates nested IterationState', () => {
    const codeResult = createValidCodePhaseResult()
    const state = createSwarmState({
      phaseResults: { code: codeResult },
    })

    const result = readCodePhaseResult(state)

    const iter = result!.iterations[0]!
    expect(iter).toHaveProperty('iteration')
    expect(iter).toHaveProperty('outcome')
    expect(iter).toHaveProperty('changedFiles')
    expect(iter.outcome.status).toBe('green')
  })

  it('validates GitState', () => {
    const codeResult = createValidCodePhaseResult()
    const state = createSwarmState({
      phaseResults: { code: codeResult },
    })

    const result = readCodePhaseResult(state)

    const git = result!.gitState
    expect(git).toHaveProperty('branch')
    expect(git).toHaveProperty('commits')
    expect(git.commits).toHaveLength(1)
    expect(git.commits[0]!).toHaveProperty('hash')
    expect(git.commits[0]!).toHaveProperty('message')
  })

  it('validates MergedReview', () => {
    const codeResult = createValidCodePhaseResult()
    const state = createSwarmState({
      phaseResults: { code: codeResult },
    })

    const result = readCodePhaseResult(state)

    const review = result!.finalReview!
    expect(review).toHaveProperty('findings')
    expect(review).toHaveProperty('criticalCount')
    expect(review).toHaveProperty('importantCount')
    expect(review).toHaveProperty('suggestionCount')
  })

  it('accepts truthful terminal statuses for failed runs', () => {
    const codeResult = createValidCodePhaseResult()
    codeResult.success = false
    codeResult.terminalStatus = 'max-iterations'
    codeResult.taskCompletions = [
      { taskId: 'TASK-1', title: 'Implement feature', status: 'max-iterations', attempts: 3 },
    ]
    codeResult.iterations = [
      {
        iteration: 1,
        outcome: {
          status: 'max-iterations',
          testResult: { totalTests: 5, passingTests: 4, failingTests: 1, durationMs: 1200 },
        },
        changedFiles: ['src/feature.ts'],
      },
    ]
    const state = createSwarmState({
      phaseResults: { code: codeResult },
    })

    const result = readCodePhaseResult(state)

    expect(result?.terminalStatus).toBe('max-iterations')
    expect(result?.taskCompletions?.[0]?.status).toBe('max-iterations')
  })
})

// ---------------------------------------------------------------------------
// Helpers for Spec 5 (DocsPhaseResult)
// ---------------------------------------------------------------------------

function createValidDocsPhaseResult(): DocsPhaseResult {
  return {
    deliveryReportJsonPath: '.swarm/artifacts/test-session/delivery-report.json',
    deliveryReportMarkdownPath: '.swarm/artifacts/test-session/delivery-report.md',
    iterationLogJsonPath: '.swarm/artifacts/test-session/iterations.json',
    iterationLogMarkdownPath: '.swarm/artifacts/test-session/iterations.md',
    commitHash: 'def5678',
    success: true,
  }
}

// ---------------------------------------------------------------------------
// readDocsPhaseResult
// ---------------------------------------------------------------------------

describe('readDocsPhaseResult', () => {
  it('returns null when phaseResults.docs is absent', () => {
    const state = createSwarmState({ phaseResults: {} })

    const result = readDocsPhaseResult(state)

    expect(result).toBeNull()
  })

  it('returns validated DocsPhaseResult when present', () => {
    const docsResult = createValidDocsPhaseResult()
    const state = createSwarmState({
      phaseResults: { docs: docsResult },
    })

    const result = readDocsPhaseResult(state)

    expect(result).not.toBeNull()
    expect(result!.success).toBe(true)
    expect(result!.deliveryReportMarkdownPath).toContain('delivery-report.md')
    expect(result!.iterationLogMarkdownPath).toContain('iterations.md')
  })

  it('throws on structurally invalid data', () => {
    const state = createSwarmState({
      phaseResults: { docs: { invalid: 'structure' } },
    })

    expect(() => readDocsPhaseResult(state)).toThrow()
  })

  it('validates optional commitHash field', () => {
    const docsResult = createValidDocsPhaseResult()
    delete (docsResult as Record<string, unknown>).commitHash
    const state = createSwarmState({
      phaseResults: { docs: docsResult },
    })

    const result = readDocsPhaseResult(state)

    expect(result).not.toBeNull()
    expect(result!.commitHash).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Zod schema validation for Spec 5 types
// ---------------------------------------------------------------------------

describe('Spec 5 Zod schemas', () => {
  it('deliveryReportInputSchema validates a well-formed input', () => {
    const valid = {
      schemaVersion: 2,
      sessionId: 'test-session',
      specPath: '/tmp/project/spec.md',
      specItems: [
        {
          title: 'Feature',
          iterationCount: 1,
          success: true,
          tasks: [{
            id: 'TASK-1',
            title: 'Task',
            tag: 'backend',
            filesModified: ['src/a.ts'],
          }],
          testResult: { totalTests: 5, passingTests: 5, failingTests: 0, durationMs: 1000 },
          reviewFindings: [{
            file: 'src/a.ts',
            severity: 'important',
            category: 'quality',
            description: 'Example finding',
            resolved: true,
            resolution: 'Resolved in iteration 1',
          }],
          commitHash: 'abc1234',
        },
      ],
      totalDuration: 60000,
      startedAt: '2026-01-15T10:00:00.000Z',
      completedAt: '2026-01-15T10:01:00.000Z',
    }

    const result = deliveryReportInputSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('deliveryReportInputSchema rejects missing required fields', () => {
    const result = deliveryReportInputSchema.safeParse({ sessionId: 'x' })
    expect(result.success).toBe(false)
  })

  it('iterationLogEntrySchema validates a well-formed entry', () => {
    const valid = {
      specItem: 'Feature',
      iterationIndex: 1,
      agentsInvoked: [{ role: 'code', model: 'opus', durationMs: 5000 }],
      testResult: { totalTests: 10, passingTests: 10, failingTests: 0, durationMs: 2000 },
      reviewFindingCount: 0,
      filesChanged: ['src/a.ts'],
    }

    const result = iterationLogEntrySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('iterationLogEntrySchema allows optional testResult', () => {
    const valid = {
      specItem: 'Feature',
      iterationIndex: 1,
      agentsInvoked: [],
      reviewFindingCount: 0,
      filesChanged: [],
    }

    const result = iterationLogEntrySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('docsPhaseResultSchema validates a well-formed result', () => {
    const valid = createValidDocsPhaseResult()

    const result = docsPhaseResultSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('docsPhaseResultSchema rejects missing required fields', () => {
    const result = docsPhaseResultSchema.safeParse({ success: true })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// spec-compliance category support
// ---------------------------------------------------------------------------

describe('agentInvocationRecordSchema — consistency role', () => {
  it('accepts consistency as a valid role', () => {
    const valid = { role: 'consistency', model: 'opus', durationMs: 3000 }
    const result = agentInvocationRecordSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('accepts all 8 agent roles', () => {
    const roles = ['plan', 'test', 'code', 'review', 'security', 'consistency', 'merge', 'docs']
    for (const role of roles) {
      const result = agentInvocationRecordSchema.safeParse({ role, model: 'opus', durationMs: 1000 })
      expect(result.success).toBe(true)
    }
  })
})

describe('agentInvocationRecordSchema — tokenUsage', () => {
  it('accepts a record with tokenUsage', () => {
    const valid = {
      role: 'code',
      model: 'opus',
      durationMs: 5000,
      tokenUsage: { input: 1200, output: 400, cacheCreation: 500, cacheRead: 8000 },
    }
    const result = agentInvocationRecordSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('accepts a record without tokenUsage (backward compat)', () => {
    const valid = { role: 'code', model: 'opus', durationMs: 5000 }
    const result = agentInvocationRecordSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects tokenUsage with missing fields', () => {
    const invalid = {
      role: 'code',
      model: 'opus',
      durationMs: 5000,
      tokenUsage: { input: 100 },
    }
    const result = agentInvocationRecordSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('ReviewCategory — spec-compliance', () => {
  it('accepts spec-compliance as a valid ReviewFinding category in CodePhaseResult', () => {
    const codeResult: CodePhaseResult = {
      ...createValidCodePhaseResult(),
      finalReview: {
        findings: [{
          file: 'src/nav.ts',
          line: 5,
          severity: 'critical',
          category: 'spec-compliance',
          description: 'Missing anchor target for nav link',
        }],
        criticalCount: 1,
        importantCount: 0,
        suggestionCount: 0,
      },
    }
    const state = createSwarmState({
      phaseResults: { code: codeResult },
    })

    const result = readCodePhaseResult(state)

    expect(result).not.toBeNull()
    expect(result!.finalReview!.findings[0]!.category).toBe('spec-compliance')
  })
})

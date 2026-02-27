import { describe, it, expect } from 'vitest'
import { readPlanPhaseResult, readTddPhaseResult, readCodePhaseResult } from '../src/phase-results.js'
import type { PlanPhaseResult, TddPhaseResult, CodePhaseResult } from '../src/phase-results.js'
import { createSwarmState } from './__test-utils__/factories.js'

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
        files: ['src/feature.ts'],
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
      testCommand: 'vitest run',
    },
    taskCount: 1,
    tags: { backend: 1 },
  }
}

function createValidTddPhaseResult(): TddPhaseResult {
  return {
    testFiles: ['tests/feature.test.ts'],
    redVerification: {
      totalTests: 5,
      passingTests: 0,
      failingTests: 5,
      durationMs: 300,
      syntaxErrors: [],
      testFiles: ['tests/feature.test.ts'],
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
    expect(task).toHaveProperty('files')
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
    expect(result!.redVerification.isRed).toBe(true)
  })

  it('throws on structurally invalid data', () => {
    const state = createSwarmState({
      phaseResults: { tdd: { notValid: true } },
    })

    expect(() => readTddPhaseResult(state)).toThrow()
  })

  it('validates TddPhaseResult has testFiles and redVerification', () => {
    const tddResult = createValidTddPhaseResult()
    const state = createSwarmState({
      phaseResults: { tdd: tddResult },
    })

    const result = readTddPhaseResult(state)

    expect(result).toHaveProperty('testFiles')
    expect(result).toHaveProperty('redVerification')
  })

  it('validates RedVerification shape in TddPhaseResult', () => {
    const tddResult = createValidTddPhaseResult()
    const state = createSwarmState({
      phaseResults: { tdd: tddResult },
    })

    const result = readTddPhaseResult(state)

    const rv = result!.redVerification
    expect(rv).toHaveProperty('totalTests')
    expect(rv).toHaveProperty('passingTests')
    expect(rv).toHaveProperty('failingTests')
    expect(rv).toHaveProperty('durationMs')
    expect(rv).toHaveProperty('syntaxErrors')
    expect(rv).toHaveProperty('testFiles')
    expect(rv).toHaveProperty('isRed')
  })
})

// ---------------------------------------------------------------------------
// Helpers for Spec 4 (CodePhaseResult)
// ---------------------------------------------------------------------------

function createValidCodePhaseResult(): CodePhaseResult {
  return {
    batches: [
      {
        batchIndex: 0,
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
    expect(result!.batches).toHaveLength(1)
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
})

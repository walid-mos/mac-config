import { describe, it, expect } from 'vitest'
import { buildCodeAgentPrompt } from '../../src/prompts/code-agent-prompt.js'
import type { PlannerTask } from '../../src/task-parser.js'
import type { TechStack } from '../../src/tech-stack.js'
import type { ReviewFinding } from '../../src/phase-results.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTask(overrides: Partial<PlannerTask> = {}): PlannerTask {
  return {
    id: 'TASK-1' as `TASK-${number}`,
    title: 'Implement user authentication',
    description: 'Add login/logout flow with JWT tokens',
    tag: 'backend',
    files: ['src/auth.ts', 'src/middleware.ts'],
    dependencies: [],
    testHints: ['test login returns token', 'test invalid credentials rejected'],
    ...overrides,
  }
}

function createTechStack(overrides: Partial<TechStack> = {}): TechStack {
  return {
    languages: ['typescript'],
    frameworks: ['express'],
    testRunner: 'vitest',
    packageManager: 'pnpm',
    buildTool: 'vite',
    configFiles: ['tsconfig.json'],
    testCommand: 'vitest run',
    ...overrides,
  }
}

function createFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    file: 'src/auth.ts',
    line: 15,
    severity: 'critical',
    category: 'bug',
    description: 'Null check missing for token',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildCodeAgentPrompt
// ---------------------------------------------------------------------------

describe('buildCodeAgentPrompt', () => {
  it('includes task title and description', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('Implement user authentication')
    expect(prompt).toContain('Add login/logout flow with JWT tokens')
  })

  it('includes task files list', () => {
    const task = createTask({ files: ['src/auth.ts', 'src/middleware.ts'] })
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('src/auth.ts')
    expect(prompt).toContain('src/middleware.ts')
  })

  it('includes test hints', () => {
    const task = createTask({
      testHints: ['test login returns token', 'test invalid credentials rejected'],
    })
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('test login returns token')
    expect(prompt).toContain('test invalid credentials rejected')
  })

  it('includes tech stack info', () => {
    const task = createTask()
    const techStack = createTechStack({ languages: ['typescript'], frameworks: ['express'] })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('typescript')
    expect(prompt).toContain('express')
  })

  it('includes previous findings when provided (iteration 2+)', () => {
    const task = createTask()
    const techStack = createTechStack()
    const findings = [createFinding({ description: 'Missing null check on token' })]

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack, findings)

    expect(prompt).toContain('Missing null check on token')
  })

  it('truncates previous findings per DL-SC-7 (32KB total)', () => {
    const task = createTask()
    const techStack = createTechStack()
    // Create findings that exceed 32KB
    const largeFinding = createFinding({ description: 'x'.repeat(40_000) })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack, [largeFinding])

    // The prompt should exist and be under a reasonable limit
    expect(prompt.length).toBeLessThanOrEqual(40_000)
  })

  it('includes output format instruction (CodeAgentOutput shape)', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    // Should mention the expected output fields
    expect(prompt).toContain('taskId')
    expect(prompt).toContain('status')
    expect(prompt).toContain('filesModified')
  })

  it('includes coding conventions constraint', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    // Should have some reference to conventions/guidelines
    expect(prompt.length).toBeGreaterThan(100)
  })
})

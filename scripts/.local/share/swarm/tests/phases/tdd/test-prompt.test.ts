import { describe, it, expect } from 'vitest'
import { buildTestPrompt } from '../../../src/phases/tdd/test-prompt.js'
import type { TechStack } from '../../../src/detect/tech-stack.js'
import type { PlannerTask } from '../../../src/phases/plan/task-parser.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTechStack(overrides: Partial<TechStack> = {}): TechStack {
  return {
    languages: ['typescript'],
    frameworks: ['react'],
    testRunner: 'vitest',
    packageManager: 'pnpm',
    buildTool: 'vite',
    configFiles: ['tsconfig.json', 'vitest.config.ts'],
    testCommand: 'vitest run',
    ...overrides,
  }
}

function createPlannerTask(overrides: Partial<PlannerTask> = {}): PlannerTask {
  return {
    id: 'TASK-1' as `TASK-${number}`,
    title: 'Implement auth service',
    description: 'Create authentication service with login and logout',
    tag: 'backend',
    files: ['src/auth/service.ts'],
    dependencies: [],
    testHints: ['test login returns token', 'test logout invalidates session'],
    ...overrides,
  }
}

const PLANNER_OUTPUT = `
## Task Decomposition

### TASK-1: Implement auth service
- **Tag**: backend
- **Files**: src/auth/service.ts
- **Dependencies**: none
- **Description**: Create authentication service
- **Test hints**: test login returns token
`

const TEST_CONVENTIONS = [
  'tests/**/*.test.ts',
  'use describe/it/expect from vitest',
  'use factories from __test-utils__/factories.ts',
]

// ---------------------------------------------------------------------------
// Prompt content
// ---------------------------------------------------------------------------

describe('buildTestPrompt — content', () => {
  it('returns a non-empty string', () => {
    const result = buildTestPrompt(
      PLANNER_OUTPUT,
      [createPlannerTask()],
      createTechStack(),
      TEST_CONVENTIONS
    )

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes planner output', () => {
    const result = buildTestPrompt(
      PLANNER_OUTPUT,
      [createPlannerTask()],
      createTechStack(),
      TEST_CONVENTIONS
    )

    expect(result).toContain('TASK-1')
  })

  it('includes tech stack info (test runner, framework)', () => {
    const result = buildTestPrompt(
      PLANNER_OUTPUT,
      [createPlannerTask()],
      createTechStack({ testRunner: 'vitest', frameworks: ['react'] }),
      TEST_CONVENTIONS
    )

    expect(result).toMatch(/vitest/i)
  })

  it('includes testing conventions', () => {
    const result = buildTestPrompt(
      PLANNER_OUTPUT,
      [createPlannerTask()],
      createTechStack(),
      TEST_CONVENTIONS
    )

    expect(result).toMatch(/test.*\.ts|convention|pattern/i)
  })

  it('includes constraints (tests must fail, syntactically valid)', () => {
    const result = buildTestPrompt(
      PLANNER_OUTPUT,
      [createPlannerTask()],
      createTechStack(),
      TEST_CONVENTIONS
    )

    expect(result).toMatch(/fail|red|must not pass/i)
    expect(result).toMatch(/syntactically valid|syntax|valid/i)
  })

  it('includes role description', () => {
    const result = buildTestPrompt(
      PLANNER_OUTPUT,
      [createPlannerTask()],
      createTechStack(),
      TEST_CONVENTIONS
    )

    expect(result).toMatch(/tdd|test engineer|test writer/i)
  })

  it('includes task descriptions from PlannerTask[]', () => {
    const tasks = [
      createPlannerTask({ title: 'Auth service' }),
      createPlannerTask({ id: 'TASK-2' as `TASK-${number}`, title: 'User model' }),
    ]

    const result = buildTestPrompt(
      PLANNER_OUTPUT,
      tasks,
      createTechStack(),
      TEST_CONVENTIONS
    )

    expect(result).toContain('Auth service')
    expect(result).toContain('User model')
  })

  it('includes instructions about test file location', () => {
    const result = buildTestPrompt(
      PLANNER_OUTPUT,
      [createPlannerTask()],
      createTechStack(),
      TEST_CONVENTIONS
    )

    expect(result).toMatch(/test file|file|location|directory|path/i)
  })
})

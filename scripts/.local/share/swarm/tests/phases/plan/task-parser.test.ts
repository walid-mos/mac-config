import { describe, it, expect } from 'vitest'
import { parseTaskDecomposition, parseTechStack } from '../../../src/phases/plan/task-parser.js'
import type { ParseTaskResult, PlannerTask, TaskTag } from '../../../src/phases/plan/task-parser.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_DIR = '/tmp/test-project'

function buildPlannerMarkdown(tasks: Array<{
  id: string
  title: string
  tag: string
  dependencies: string[]
  description: string
  testHints?: string[]
}>): string {
  const lines = ['## Task Decomposition', '']
  for (const task of tasks) {
    lines.push(`### ${task.id}: ${task.title}`)
    lines.push(`- **Tag**: ${task.tag}`)
    lines.push(`- **Dependencies**: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'none'}`)
    lines.push(`- **Description**: ${task.description}`)
    lines.push(`- **Test hints**: ${(task.testHints ?? ['test it']).join(', ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

function singleTaskMarkdown(overrides: Partial<{
  id: string
  title: string
  tag: string
  dependencies: string[]
  description: string
  testHints: string[]
}> = {}): string {
  return buildPlannerMarkdown([{
    id: overrides.id ?? 'TASK-1',
    title: overrides.title ?? 'Implement feature',
    tag: overrides.tag ?? 'backend',
    dependencies: overrides.dependencies ?? [],
    description: overrides.description ?? 'Implement the feature',
    testHints: overrides.testHints ?? ['test the feature'],
  }])
}

// ---------------------------------------------------------------------------
// Valid parsing
// ---------------------------------------------------------------------------

describe('parseTaskDecomposition — valid parsing', () => {
  it('parses valid planner markdown into PlannerTask[]', () => {
    const markdown = buildPlannerMarkdown([
      {
        id: 'TASK-1',
        title: 'Setup API',
        tag: 'backend',
        dependencies: [],
        description: 'Set up the API routes',
        testHints: ['test API endpoints'],
      },
      {
        id: 'TASK-2',
        title: 'Build UI',
        tag: 'frontend',
        dependencies: ['TASK-1'],
        description: 'Build the user interface',
        testHints: ['test component rendering'],
      },
    ])

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks).toHaveLength(2)
    expect(result.tasks[0]!.id).toBe('TASK-1')
    expect(result.tasks[1]!.id).toBe('TASK-2')
  })

  it('extracts task ID in TASK-N format', () => {
    const markdown = singleTaskMarkdown({ id: 'TASK-42' })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.id).toBe('TASK-42')
  })

  it('extracts title', () => {
    const markdown = singleTaskMarkdown({ title: 'My feature title' })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.title).toBe('My feature title')
  })

  it('extracts tag as a valid TaskTag', () => {
    const markdown = singleTaskMarkdown({ tag: 'frontend' })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.tag).toBe('frontend')
  })

  it('extracts dependencies', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', dependencies: [], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', dependencies: ['TASK-1'], description: 'B' },
    ])

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[1]!.dependencies).toEqual(['TASK-1'])
  })

  it('extracts description', () => {
    const markdown = singleTaskMarkdown({ description: 'Detailed description here' })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.description).toBe('Detailed description here')
  })

  it('extracts testHints', () => {
    const markdown = singleTaskMarkdown({ testHints: ['test error handling', 'test happy path'] })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.testHints).toContain('test error handling')
    expect(result.tasks[0]!.testHints).toContain('test happy path')
  })

  it('returns ParseTaskResult shape { tasks, warnings }', () => {
    const markdown = singleTaskMarkdown()

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result).toHaveProperty('tasks')
    expect(result).toHaveProperty('warnings')
    expect(Array.isArray(result.tasks)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tag validation
// ---------------------------------------------------------------------------

describe('parseTaskDecomposition — tag validation', () => {
  it('accepts "backend" tag', () => {
    const markdown = singleTaskMarkdown({ tag: 'backend' })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.tag).toBe('backend')
  })

  it('accepts "frontend" tag', () => {
    const markdown = singleTaskMarkdown({ tag: 'frontend' })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.tag).toBe('frontend')
  })

  it('accepts "fullstack" tag', () => {
    const markdown = singleTaskMarkdown({ tag: 'fullstack' })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.tag).toBe('fullstack')
  })

  it('rejects invalid tags', () => {
    const markdown = singleTaskMarkdown({ tag: 'devops' })

    expect(() => parseTaskDecomposition(markdown, PROJECT_DIR)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// ID validation
// ---------------------------------------------------------------------------

describe('parseTaskDecomposition — ID validation', () => {
  it('rejects invalid task IDs (not TASK-N format)', () => {
    const markdown = singleTaskMarkdown({ id: 'INVALID-1' })

    expect(() => parseTaskDecomposition(markdown, PROJECT_DIR)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DAG validation (cycle detection)
// ---------------------------------------------------------------------------

describe('parseTaskDecomposition — DAG validation', () => {
  it('detects circular dependencies and throws', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', dependencies: ['TASK-2'], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', dependencies: ['TASK-1'], description: 'B' },
    ])

    expect(() => parseTaskDecomposition(markdown, PROJECT_DIR)).toThrow(/circular|cycle/i)
  })

  it('reports cycle-participating task IDs in the error message', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', dependencies: ['TASK-3'], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', dependencies: ['TASK-1'], description: 'B' },
      { id: 'TASK-3', title: 'C', tag: 'backend', dependencies: ['TASK-2'], description: 'C' },
    ])

    try {
      parseTaskDecomposition(markdown, PROJECT_DIR)
      expect.unreachable('should have thrown on circular dependency')
    } catch (err) {
      const message = (err as Error).message
      expect(message).toMatch(/TASK-1|TASK-2|TASK-3/)
    }
  })

  it('detects 3-node cycle', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', dependencies: ['TASK-3'], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', dependencies: ['TASK-1'], description: 'B' },
      { id: 'TASK-3', title: 'C', tag: 'backend', dependencies: ['TASK-2'], description: 'C' },
    ])

    expect(() => parseTaskDecomposition(markdown, PROJECT_DIR)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('parseTaskDecomposition — edge cases', () => {
  it('handles single-task plans', () => {
    const markdown = singleTaskMarkdown()

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks).toHaveLength(1)
  })

  it('handles tasks with no dependencies', () => {
    const markdown = singleTaskMarkdown({ dependencies: [] })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.dependencies).toEqual([])
  })

  it('handles tasks with multiple dependencies', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', dependencies: [], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', dependencies: [], description: 'B' },
      { id: 'TASK-3', title: 'C', tag: 'fullstack', dependencies: ['TASK-1', 'TASK-2'], description: 'C' },
    ])

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[2]!.dependencies).toEqual(['TASK-1', 'TASK-2'])
  })

})

// ---------------------------------------------------------------------------
// parseTechStack
// ---------------------------------------------------------------------------

describe('parseTechStack — valid tech stack section', () => {
  it('parses a complete ## Tech Stack section', () => {
    const input = `## Tech Stack
- **Package Manager**: pnpm
- **Test Command**: pnpm exec vitest run
- **Build Command**: pnpm run build
- **Languages**: typescript, javascript
- **Frameworks**: react, express
- **Test Runner**: vitest
- **Build Tool**: vite
- **Config Files**: tsconfig.json, vitest.config.ts

## Task Decomposition

### TASK-1: Feature
- **Tag**: backend
`

    const result = parseTechStack(input)

    expect(result.packageManager).toBe('pnpm')
    expect(result.testCommand).toBe('pnpm exec vitest run')
    expect(result.buildCommand).toBe('pnpm run build')
    expect(result.languages).toEqual(['typescript', 'javascript'])
    expect(result.frameworks).toEqual(['react', 'express'])
    expect(result.testRunner).toBe('vitest')
    expect(result.buildTool).toBe('vite')
    expect(result.configFiles).toEqual(['tsconfig.json', 'vitest.config.ts'])
  })
})

describe('parseTechStack — missing fields use defaults', () => {
  it('defaults packageManager to npm', () => {
    const input = `## Tech Stack

## Task Decomposition
`
    const result = parseTechStack(input)

    expect(result.packageManager).toBe('npm')
  })

  it('defaults testCommand to "<packageManager> test"', () => {
    const input = `## Tech Stack
- **Package Manager**: yarn

## Task Decomposition
`
    const result = parseTechStack(input)

    expect(result.testCommand).toBe('yarn test')
  })

  it('defaults buildCommand to null', () => {
    const input = `## Tech Stack

## Task Decomposition
`
    const result = parseTechStack(input)

    expect(result.buildCommand).toBeNull()
  })

  it('defaults languages to empty array', () => {
    const input = `## Tech Stack

## Task Decomposition
`
    const result = parseTechStack(input)

    expect(result.languages).toEqual([])
  })

  it('defaults frameworks to empty array', () => {
    const input = `## Tech Stack

## Task Decomposition
`
    const result = parseTechStack(input)

    expect(result.frameworks).toEqual([])
  })

  it('defaults testRunner to null', () => {
    const input = `## Tech Stack

## Task Decomposition
`
    const result = parseTechStack(input)

    expect(result.testRunner).toBeNull()
  })

  it('defaults buildTool to null', () => {
    const input = `## Tech Stack

## Task Decomposition
`
    const result = parseTechStack(input)

    expect(result.buildTool).toBeNull()
  })

  it('defaults configFiles to empty array', () => {
    const input = `## Tech Stack

## Task Decomposition
`
    const result = parseTechStack(input)

    expect(result.configFiles).toEqual([])
  })
})

describe('parseTechStack — no tech stack section', () => {
  it('returns all defaults when no ## Tech Stack header exists', () => {
    const input = `## Task Decomposition

### TASK-1: Feature
- **Tag**: backend
`

    const result = parseTechStack(input)

    expect(result.packageManager).toBe('npm')
    expect(result.testCommand).toBe('npm test')
    expect(result.buildCommand).toBeNull()
    expect(result.languages).toEqual([])
    expect(result.frameworks).toEqual([])
    expect(result.testRunner).toBeNull()
    expect(result.buildTool).toBeNull()
    expect(result.configFiles).toEqual([])
  })
})

describe('parseTechStack — typecheck and lint commands', () => {
  it('parses typecheckCommand from Tech Stack section', () => {
    const input = `## Tech Stack
- **Package Manager**: pnpm
- **Test Command**: pnpm test
- **Build Command**: none
- **Typecheck Command**: pnpm exec tsc --noEmit
- **Lint Command**: none

## Task Decomposition
`

    const result = parseTechStack(input)

    expect(result.typecheckCommand).toBe('pnpm exec tsc --noEmit')
    expect(result.lintCommand).toBeNull()
  })

  it('parses lintCommand from Tech Stack section', () => {
    const input = `## Tech Stack
- **Package Manager**: pnpm
- **Test Command**: pnpm test
- **Typecheck Command**: none
- **Lint Command**: pnpm exec eslint .

## Task Decomposition
`

    const result = parseTechStack(input)

    expect(result.typecheckCommand).toBeNull()
    expect(result.lintCommand).toBe('pnpm exec eslint .')
  })

  it('defaults typecheckCommand and lintCommand to null when absent', () => {
    const input = `## Tech Stack
- **Package Manager**: pnpm

## Task Decomposition
`

    const result = parseTechStack(input)

    expect(result.typecheckCommand).toBeNull()
    expect(result.lintCommand).toBeNull()
  })

  it('treats "none" as null for typecheck and lint commands', () => {
    const input = `## Tech Stack
- **Typecheck Command**: none
- **Lint Command**: none

## Task Decomposition
`

    const result = parseTechStack(input)

    expect(result.typecheckCommand).toBeNull()
    expect(result.lintCommand).toBeNull()
  })
})

describe('parseTechStack — partial fields', () => {
  it('parses a section with only some fields present', () => {
    const input = `## Tech Stack
- **Package Manager**: bun
- **Test Runner**: jest

## Task Decomposition
`

    const result = parseTechStack(input)

    expect(result.packageManager).toBe('bun')
    expect(result.testRunner).toBe('jest')
    expect(result.testCommand).toBe('bun test')
    expect(result.buildCommand).toBeNull()
    expect(result.languages).toEqual([])
  })

  it('treats "none" as null/empty for nullable fields', () => {
    const input = `## Tech Stack
- **Package Manager**: pnpm
- **Test Command**: pnpm test
- **Build Command**: none
- **Frameworks**: none
- **Test Runner**: none
- **Build Tool**: none

## Task Decomposition
`

    const result = parseTechStack(input)

    expect(result.buildCommand).toBeNull()
    expect(result.frameworks).toEqual([])
    expect(result.testRunner).toBeNull()
    expect(result.buildTool).toBeNull()
  })
})

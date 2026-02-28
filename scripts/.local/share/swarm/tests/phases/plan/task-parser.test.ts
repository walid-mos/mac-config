import { describe, it, expect } from 'vitest'
import { parseTaskDecomposition } from '../../../src/phases/plan/task-parser.js'
import type { ParseTaskResult, PlannerTask, TaskTag } from '../../../src/phases/plan/task-parser.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_DIR = '/tmp/test-project'

function buildPlannerMarkdown(tasks: Array<{
  id: string
  title: string
  tag: string
  files: string[]
  dependencies: string[]
  description: string
  testHints?: string[]
}>): string {
  const lines = ['## Task Decomposition', '']
  for (const task of tasks) {
    lines.push(`### ${task.id}: ${task.title}`)
    lines.push(`- **Tag**: ${task.tag}`)
    lines.push(`- **Files**: ${task.files.join(', ')}`)
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
  files: string[]
  dependencies: string[]
  description: string
  testHints: string[]
}> = {}): string {
  return buildPlannerMarkdown([{
    id: overrides.id ?? 'TASK-1',
    title: overrides.title ?? 'Implement feature',
    tag: overrides.tag ?? 'backend',
    files: overrides.files ?? ['src/feature.ts'],
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
        files: ['src/api.ts', 'src/routes.ts'],
        dependencies: [],
        description: 'Set up the API routes',
        testHints: ['test API endpoints'],
      },
      {
        id: 'TASK-2',
        title: 'Build UI',
        tag: 'frontend',
        files: ['src/components/App.tsx'],
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

  it('extracts files list', () => {
    const markdown = singleTaskMarkdown({ files: ['src/a.ts', 'src/b.ts'] })

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.files).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('extracts dependencies', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', files: ['src/a.ts'], dependencies: [], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', files: ['src/b.ts'], dependencies: ['TASK-1'], description: 'B' },
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
// File path validation (PT-SC-3)
// ---------------------------------------------------------------------------

describe('parseTaskDecomposition — file path validation (PT-SC-3)', () => {
  it('rejects absolute file paths', () => {
    const markdown = singleTaskMarkdown({ files: ['/etc/passwd'] })

    expect(() => parseTaskDecomposition(markdown, PROJECT_DIR)).toThrow()
  })

  it('rejects file paths with .. traversal', () => {
    const markdown = singleTaskMarkdown({ files: ['../../../etc/passwd'] })

    expect(() => parseTaskDecomposition(markdown, PROJECT_DIR)).toThrow()
  })

  it('rejects file paths with embedded .. traversal', () => {
    const markdown = singleTaskMarkdown({ files: ['src/../../etc/passwd'] })

    expect(() => parseTaskDecomposition(markdown, PROJECT_DIR)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DAG validation (cycle detection)
// ---------------------------------------------------------------------------

describe('parseTaskDecomposition — DAG validation', () => {
  it('detects circular dependencies and throws', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', files: ['src/a.ts'], dependencies: ['TASK-2'], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', files: ['src/b.ts'], dependencies: ['TASK-1'], description: 'B' },
    ])

    expect(() => parseTaskDecomposition(markdown, PROJECT_DIR)).toThrow(/circular|cycle/i)
  })

  it('reports cycle-participating task IDs in the error message', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', files: ['src/a.ts'], dependencies: ['TASK-3'], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', files: ['src/b.ts'], dependencies: ['TASK-1'], description: 'B' },
      { id: 'TASK-3', title: 'C', tag: 'backend', files: ['src/c.ts'], dependencies: ['TASK-2'], description: 'C' },
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
      { id: 'TASK-1', title: 'A', tag: 'backend', files: ['src/a.ts'], dependencies: ['TASK-3'], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', files: ['src/b.ts'], dependencies: ['TASK-1'], description: 'B' },
      { id: 'TASK-3', title: 'C', tag: 'backend', files: ['src/c.ts'], dependencies: ['TASK-2'], description: 'C' },
    ])

    expect(() => parseTaskDecomposition(markdown, PROJECT_DIR)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Non-overlapping file validation for parallel tasks
// ---------------------------------------------------------------------------

describe('parseTaskDecomposition — file overlap validation', () => {
  it('auto-adds dependency edge when file overlap detected for parallel tasks', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', files: ['src/shared.ts'], dependencies: [], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', files: ['src/shared.ts'], dependencies: [], description: 'B' },
    ])

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    // One of the tasks should have gained a dependency on the other
    const task1Deps = result.tasks.find(t => t.id === 'TASK-1')!.dependencies
    const task2Deps = result.tasks.find(t => t.id === 'TASK-2')!.dependencies
    const hasSerializedDependency = task1Deps.includes('TASK-2' as `TASK-${number}`) ||
      task2Deps.includes('TASK-1' as `TASK-${number}`)
    expect(hasSerializedDependency).toBe(true)
  })

  it('records self-healing actions in warnings[]', () => {
    const markdown = buildPlannerMarkdown([
      { id: 'TASK-1', title: 'A', tag: 'backend', files: ['src/shared.ts'], dependencies: [], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', files: ['src/shared.ts'], dependencies: [], description: 'B' },
    ])

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some(w => w.includes('src/shared.ts') || w.includes('overlap'))).toBe(true)
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
      { id: 'TASK-1', title: 'A', tag: 'backend', files: ['src/a.ts'], dependencies: [], description: 'A' },
      { id: 'TASK-2', title: 'B', tag: 'backend', files: ['src/b.ts'], dependencies: [], description: 'B' },
      { id: 'TASK-3', title: 'C', tag: 'fullstack', files: ['src/c.ts'], dependencies: ['TASK-1', 'TASK-2'], description: 'C' },
    ])

    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[2]!.dependencies).toEqual(['TASK-1', 'TASK-2'])
  })

  it('handles empty files list', () => {
    const markdown = singleTaskMarkdown({ files: [] })

    // Empty files list could be valid (task might only describe behavior)
    // or throw depending on implementation. The test validates behavior exists.
    const result = parseTaskDecomposition(markdown, PROJECT_DIR)

    expect(result.tasks[0]!.files).toEqual([])
  })
})

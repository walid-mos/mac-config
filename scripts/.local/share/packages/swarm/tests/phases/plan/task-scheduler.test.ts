import { describe, it, expect } from 'vitest'
import { buildDependencyGraph } from '../../../src/phases/plan/task-scheduler.js'
import type { PlannerTask } from '../../../src/phases/plan/task-parser.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTask(
  id: `TASK-${number}`,
  deps: `TASK-${number}`[] = [],
  overrides: Partial<PlannerTask> = {}
): PlannerTask {
  return {
    id,
    title: `Task ${id}`,
    description: `Description for ${id}`,
    tag: 'backend',
    dependencies: deps,
    testHints: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildDependencyGraph
// ---------------------------------------------------------------------------

describe('buildDependencyGraph', () => {
  it('returns empty maps for empty input', () => {
    const graph = buildDependencyGraph([])

    expect(graph.inDegree.size).toBe(0)
    expect(graph.dependents.size).toBe(0)
    expect(graph.taskMap.size).toBe(0)
  })

  it('sets inDegree to 0 for tasks with no dependencies', () => {
    const tasks = [createTask('TASK-1'), createTask('TASK-2')]
    const graph = buildDependencyGraph(tasks)

    expect(graph.inDegree.get('TASK-1')).toBe(0)
    expect(graph.inDegree.get('TASK-2')).toBe(0)
  })

  it('computes correct inDegree for tasks with dependencies', () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', ['TASK-1']),
      createTask('TASK-3', ['TASK-1', 'TASK-2']),
    ]
    const graph = buildDependencyGraph(tasks)

    expect(graph.inDegree.get('TASK-1')).toBe(0)
    expect(graph.inDegree.get('TASK-2')).toBe(1)
    expect(graph.inDegree.get('TASK-3')).toBe(2)
  })

  it('builds correct dependents map', () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', ['TASK-1']),
      createTask('TASK-3', ['TASK-1']),
    ]
    const graph = buildDependencyGraph(tasks)

    const deps = graph.dependents.get('TASK-1')!.sort()
    expect(deps).toEqual(['TASK-2', 'TASK-3'])
    expect(graph.dependents.get('TASK-2')).toEqual([])
    expect(graph.dependents.get('TASK-3')).toEqual([])
  })

  it('populates taskMap with all tasks', () => {
    const tasks = [createTask('TASK-1'), createTask('TASK-2')]
    const graph = buildDependencyGraph(tasks)

    expect(graph.taskMap.size).toBe(2)
    expect(graph.taskMap.get('TASK-1')!.id).toBe('TASK-1')
    expect(graph.taskMap.get('TASK-2')!.id).toBe('TASK-2')
  })

  it('ignores dependencies on tasks not in the input list', () => {
    const tasks = [
      createTask('TASK-2', ['TASK-1']), // TASK-1 not in list
    ]
    const graph = buildDependencyGraph(tasks)

    expect(graph.inDegree.get('TASK-2')).toBe(0) // ignored external dep
  })
})

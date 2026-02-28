import { describe, it, expect } from 'vitest'
import { buildTaskBatches } from '../../../src/phases/plan/task-scheduler.js'
import type { PlannerTask } from '../../../src/phases/plan/task-parser.js'
import type { TaskBatch } from '../../../src/phases/phase-results.js'

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
    files: [`src/${id.toLowerCase()}.ts`],
    dependencies: deps,
    testHints: [],
    ...overrides,
  }
}

function allTaskIds(batches: TaskBatch[]): string[] {
  return batches.flatMap(b => b.tasks.map(t => t.id)).sort()
}

// ---------------------------------------------------------------------------
// buildTaskBatches
// ---------------------------------------------------------------------------

describe('buildTaskBatches', () => {
  it('places tasks with no dependencies in batch 0', () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2'),
      createTask('TASK-3'),
    ]

    const batches = buildTaskBatches(tasks)

    expect(batches).toHaveLength(1)
    expect(batches[0]!.batchIndex).toBe(0)
    expect(batches[0]!.tasks).toHaveLength(3)
  })

  it('places tasks dependent on batch 0 in batch 1', () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', ['TASK-1']),
    ]

    const batches = buildTaskBatches(tasks)

    expect(batches).toHaveLength(2)
    expect(batches[0]!.batchIndex).toBe(0)
    expect(batches[0]!.tasks.map(t => t.id)).toContain('TASK-1')
    expect(batches[1]!.batchIndex).toBe(1)
    expect(batches[1]!.tasks.map(t => t.id)).toContain('TASK-2')
  })

  it('produces 3 sequential batches for a linear chain A->B->C', () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', ['TASK-1']),
      createTask('TASK-3', ['TASK-2']),
    ]

    const batches = buildTaskBatches(tasks)

    expect(batches).toHaveLength(3)
    expect(batches[0]!.tasks).toHaveLength(1)
    expect(batches[0]!.tasks[0]!.id).toBe('TASK-1')
    expect(batches[1]!.tasks).toHaveLength(1)
    expect(batches[1]!.tasks[0]!.id).toBe('TASK-2')
    expect(batches[2]!.tasks).toHaveLength(1)
    expect(batches[2]!.tasks[0]!.id).toBe('TASK-3')
  })

  it('groups parallel tasks in the same batch for diamond pattern', () => {
    // A -> B, A -> C, B -> D, C -> D
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', ['TASK-1']),
      createTask('TASK-3', ['TASK-1']),
      createTask('TASK-4', ['TASK-2', 'TASK-3']),
    ]

    const batches = buildTaskBatches(tasks)

    expect(batches).toHaveLength(3)
    // Batch 0: A
    expect(batches[0]!.tasks.map(t => t.id)).toEqual(['TASK-1'])
    // Batch 1: B and C (parallel)
    const batch1Ids = batches[1]!.tasks.map(t => t.id).sort()
    expect(batch1Ids).toEqual(['TASK-2', 'TASK-3'])
    // Batch 2: D
    expect(batches[2]!.tasks.map(t => t.id)).toEqual(['TASK-4'])
  })

  it('returns a single batch for a single task with no dependencies', () => {
    const tasks = [createTask('TASK-1')]

    const batches = buildTaskBatches(tasks)

    expect(batches).toHaveLength(1)
    expect(batches[0]!.batchIndex).toBe(0)
    expect(batches[0]!.tasks).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    const batches = buildTaskBatches([])

    expect(batches).toEqual([])
  })

  it('places all independent tasks in batch 0', () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2'),
      createTask('TASK-3'),
      createTask('TASK-4'),
      createTask('TASK-5'),
    ]

    const batches = buildTaskBatches(tasks)

    expect(batches).toHaveLength(1)
    expect(batches[0]!.batchIndex).toBe(0)
    expect(batches[0]!.tasks).toHaveLength(5)
  })

  it('throws on cycle detection', () => {
    const tasks = [
      createTask('TASK-1', ['TASK-2']),
      createTask('TASK-2', ['TASK-1']),
    ]

    expect(() => buildTaskBatches(tasks)).toThrow()
  })

  it('produces sequential batch indices starting at 0', () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', ['TASK-1']),
      createTask('TASK-3', ['TASK-2']),
    ]

    const batches = buildTaskBatches(tasks)

    for (let i = 0; i < batches.length; i++) {
      expect(batches[i]!.batchIndex).toBe(i)
    }
  })

  it('accounts for all tasks (no tasks lost)', () => {
    const tasks = [
      createTask('TASK-1'),
      createTask('TASK-2', ['TASK-1']),
      createTask('TASK-3', ['TASK-1']),
      createTask('TASK-4', ['TASK-2', 'TASK-3']),
      createTask('TASK-5'),
    ]

    const batches = buildTaskBatches(tasks)
    const resultIds = allTaskIds(batches)
    const inputIds = tasks.map(t => t.id).sort()

    expect(resultIds).toEqual(inputIds)
  })
})

// === Task Scheduler (Spec 4 — FR-1) ===

import type { PlannerTask } from './task-parser.js'
import type { TaskBatch } from './phase-results.js'

// === API ===

export function buildTaskBatches(tasks: PlannerTask[]): TaskBatch[] {
  if (tasks.length === 0) return []

  const taskMap = new Map<string, PlannerTask>()
  for (const task of tasks) {
    taskMap.set(task.id, task)
  }

  // Track in-degrees (number of unresolved dependencies)
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const task of tasks) {
    inDegree.set(task.id, 0)
    dependents.set(task.id, [])
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskMap.has(dep)) continue
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
      dependents.get(dep)!.push(task.id)
    }
  }

  const batches: TaskBatch[] = []
  const resolved = new Set<string>()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Find all tasks with zero unresolved deps that haven't been placed
    const ready: PlannerTask[] = []
    for (const task of tasks) {
      if (resolved.has(task.id)) continue
      if (inDegree.get(task.id) === 0) {
        ready.push(task)
      }
    }

    if (ready.length === 0) break

    batches.push({ batchIndex: batches.length, tasks: ready })

    // Mark these as resolved, decrement dependents' in-degrees
    for (const task of ready) {
      resolved.add(task.id)
      for (const dependent of dependents.get(task.id) ?? []) {
        inDegree.set(dependent, (inDegree.get(dependent) ?? 1) - 1)
      }
    }
  }

  // Cycle detection: if not all tasks resolved, there's a cycle
  if (resolved.size < tasks.length) {
    const unresolved = tasks.filter(t => !resolved.has(t.id)).map(t => t.id)
    throw new Error(`Circular dependency detected among tasks: ${unresolved.join(', ')}`)
  }

  return batches
}

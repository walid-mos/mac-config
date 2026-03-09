// === Task Scheduler (Spec 4 — FR-1) ===

import type { PlannerTask } from './task-parser.js'

// === Dependency Graph ===

export interface DependencyGraph {
  inDegree: Map<string, number>
  dependents: Map<string, string[]>
  taskMap: Map<string, PlannerTask>
}

export function buildDependencyGraph(tasks: PlannerTask[]): DependencyGraph {
  const taskMap = new Map<string, PlannerTask>()
  for (const task of tasks) {
    taskMap.set(task.id, task)
  }

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

  return { inDegree, dependents, taskMap }
}


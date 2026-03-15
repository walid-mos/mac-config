import { randomUUID } from 'node:crypto'
import type { PlannerTask } from '../plan/task-parser.js'
import type { ReviewFinding } from '../phase-results.js'
import type { AgentHandle } from './code-phase.js'

export type TaskStatus = 'pending' | 'running' | 'converging' | 'green'

export interface TaskNode {
  taskId: string
  task: PlannerTask
  status: TaskStatus
  handle: AgentHandle
  lastFindings?: ReviewFinding[]
  attempts: number
  commitHash?: string
  decisionLogEntries: string[]
  seenSignatures: Set<string>
}

export const createTaskNode = (task: PlannerTask): TaskNode => ({
  taskId: task.id,
  task,
  status: 'pending',
  handle: {
    taskId: task.id,
    sessionId: randomUUID(),
    task,
    filesChanged: [],
    status: 'active',
  },
  attempts: 0,
  decisionLogEntries: [],
  seenSignatures: new Set(),
})

export const collectWaveNodes = (
  nodes: Iterable<TaskNode>,
  remainingDeps: ReadonlyMap<string, number>,
): { ready: TaskNode[]; fixable: TaskNode[] } => {
  const ready: TaskNode[] = []
  const fixable: TaskNode[] = []

  for (const node of nodes) {
    if (node.status === 'pending' && (remainingDeps.get(node.taskId) ?? 0) === 0) {
      ready.push(node)
      continue
    }

    if (node.status === 'converging' && node.lastFindings && node.lastFindings.length > 0) {
      fixable.push(node)
    }
  }

  return { ready, fixable }
}

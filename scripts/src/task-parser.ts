// === Task Parser (Spec 3 — FR-1, FR-3, FR-10) ===

// === Types ===

export type TaskTag = 'backend' | 'frontend' | 'fullstack'

export interface PlannerTask {
  id: `TASK-${number}`
  title: string
  description: string
  tag: TaskTag
  files: string[]
  dependencies: `TASK-${number}`[]
  testHints: string[]
}

export interface ParseTaskResult {
  tasks: PlannerTask[]
  warnings: string[]
}

// === Constants ===

const TASK_ID_RE = /^TASK-\d+$/
const VALID_TAGS: ReadonlySet<string> = new Set(['backend', 'frontend', 'fullstack'])
const TASK_HEADER_RE = /^###\s+(\S+):\s*(.+)$/

// === Helpers ===

function validateTaskId(id: string): asserts id is `TASK-${number}` {
  if (!TASK_ID_RE.test(id)) {
    throw new Error(`Invalid task ID "${id}": must match TASK-N format`)
  }
}

function validateTag(tag: string): asserts tag is TaskTag {
  if (!VALID_TAGS.has(tag)) {
    throw new Error(`Invalid tag "${tag}": must be backend, frontend, or fullstack`)
  }
}

function validateFilePath(filePath: string): void {
  if (filePath.startsWith('/')) {
    throw new Error(`Absolute file path not allowed: ${filePath}`)
  }
  if (filePath.includes('..')) {
    throw new Error(`Path traversal not allowed: ${filePath}`)
  }
}

function extractField(lines: string[], prefix: string): string {
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith(`- **${prefix}**:`)) {
      return trimmed.slice(`- **${prefix}**: `.length).trim()
    }
  }
  return ''
}

function parseTaskBlock(headerLine: string, bodyLines: string[]): PlannerTask {
  const headerMatch = TASK_HEADER_RE.exec(headerLine)
  if (!headerMatch) {
    throw new Error(`Invalid task header: ${headerLine}`)
  }

  const id = headerMatch[1]!
  const title = headerMatch[2]!.trim()

  validateTaskId(id)

  const tagRaw = extractField(bodyLines, 'Tag')
  validateTag(tagRaw)

  const filesRaw = extractField(bodyLines, 'Files')
  const files = filesRaw
    ? filesRaw.split(',').map(f => f.trim()).filter(f => f.length > 0)
    : []

  for (const filePath of files) {
    validateFilePath(filePath)
  }

  const depsRaw = extractField(bodyLines, 'Dependencies')
  const dependencies: `TASK-${number}`[] = []
  if (depsRaw && depsRaw !== 'none') {
    for (const dep of depsRaw.split(',').map(d => d.trim()).filter(d => d.length > 0)) {
      validateTaskId(dep)
      dependencies.push(dep as `TASK-${number}`)
    }
  }

  const description = extractField(bodyLines, 'Description')
  const testHintsRaw = extractField(bodyLines, 'Test hints')
  const testHints = testHintsRaw
    ? testHintsRaw.split(',').map(h => h.trim()).filter(h => h.length > 0)
    : []

  return {
    id: id as `TASK-${number}`,
    title,
    description,
    tag: tagRaw,
    files,
    dependencies,
    testHints,
  }
}

function validateDag(tasks: PlannerTask[]): void {
  const taskIds = new Set(tasks.map(t => t.id))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const task of tasks) {
    inDegree.set(task.id, 0)
    adjacency.set(task.id, [])
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) continue
      adjacency.get(dep)!.push(task.id)
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
    }
  }

  // Kahn's algorithm
  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id)
    }
  }

  let processed = 0
  while (queue.length > 0) {
    const current = queue.shift()!
    processed++
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  if (processed < tasks.length) {
    const cycleParticipants = [...inDegree.entries()]
      .filter(([, degree]) => degree > 0)
      .map(([id]) => id)
    throw new Error(`Circular dependency detected among tasks: ${cycleParticipants.join(', ')}`)
  }
}

function hasTransitiveDependency(
  from: string,
  to: string,
  adjacency: Map<string, Set<string>>
): boolean {
  const visited = new Set<string>()
  const stack = [from]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === to) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const dep of adjacency.get(current) ?? []) {
      stack.push(dep)
    }
  }
  return false
}

function resolveFileOverlaps(tasks: PlannerTask[]): string[] {
  const warnings: string[] = []

  // Build dependency graph (task -> set of tasks it depends on, directly or transitively)
  const dependsOn = new Map<string, Set<string>>()
  for (const task of tasks) {
    dependsOn.set(task.id, new Set(task.dependencies))
  }

  // Build file-to-tasks map
  const fileToTasks = new Map<string, string[]>()
  for (const task of tasks) {
    for (const file of task.files) {
      const existing = fileToTasks.get(file)
      if (existing) {
        existing.push(task.id)
      } else {
        fileToTasks.set(file, [task.id])
      }
    }
  }

  // Check for overlaps between independent tasks
  for (const [file, taskIds] of fileToTasks) {
    if (taskIds.length < 2) continue

    for (let i = 0; i < taskIds.length; i++) {
      for (let j = i + 1; j < taskIds.length; j++) {
        const a = taskIds[i]!
        const b = taskIds[j]!

        const aHasDepOnB = hasTransitiveDependency(a, b, dependsOn)
        const bHasDepOnA = hasTransitiveDependency(b, a, dependsOn)

        if (!aHasDepOnB && !bHasDepOnA) {
          // Independent tasks share a file — serialize by adding dependency
          const taskB = tasks.find(t => t.id === b)!
          taskB.dependencies.push(a as `TASK-${number}`)
          dependsOn.get(b)!.add(a)
          warnings.push(
            `File overlap detected: "${file}" shared by ${a} and ${b}. Auto-added dependency ${b} -> ${a} to serialize.`
          )
        }
      }
    }
  }

  return warnings
}

// === API ===

export function parseTaskDecomposition(plannerOutput: string, _projectDir: string): ParseTaskResult {
  const lines = plannerOutput.split('\n')
  const tasks: PlannerTask[] = []

  let currentHeader: string | null = null
  let currentBody: string[] = []

  for (const line of lines) {
    const headerMatch = TASK_HEADER_RE.exec(line.trim())
    if (headerMatch) {
      // Flush previous task
      if (currentHeader !== null) {
        tasks.push(parseTaskBlock(currentHeader, currentBody))
      }
      currentHeader = line.trim()
      currentBody = []
    } else if (currentHeader !== null) {
      currentBody.push(line)
    }
  }

  // Flush last task
  if (currentHeader !== null) {
    tasks.push(parseTaskBlock(currentHeader, currentBody))
  }

  // Validate DAG before overlap resolution
  validateDag(tasks)

  // Resolve file overlaps (may mutate dependencies and produce warnings)
  const warnings = resolveFileOverlaps(tasks)

  return { tasks, warnings }
}

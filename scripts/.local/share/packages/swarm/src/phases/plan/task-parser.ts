// === Task Parser (Spec 3 — FR-1, FR-3, FR-10) ===

import type { TechStack } from '../../detect/tech-stack.js'

// === Types ===

export type TaskTag = 'backend' | 'frontend' | 'fullstack'

export interface PlannerTask {
  id: `TASK-${number}`
  title: string
  description: string
  tag: TaskTag
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

// === API ===

export function parseTechStack(plannerOutput: string): TechStack {
  const lines = plannerOutput.split('\n')

  // Find lines between "## Tech Stack" and next "##" header
  let inSection = false
  const sectionLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##\s+Tech Stack/i.test(trimmed)) {
      inSection = true
      continue
    }
    if (inSection && /^##\s/.test(trimmed)) break
    if (inSection) sectionLines.push(line)
  }

  const field = (prefix: string): string => extractField(sectionLines, prefix)

  const packageManager = field('Package Manager') || 'npm'
  const testCommand = field('Test Command') || `${packageManager} test`
  const buildCommandRaw = field('Build Command')
  const buildCommand = buildCommandRaw && buildCommandRaw !== 'none' ? buildCommandRaw : null

  const typecheckCommandRaw = field('Typecheck Command')
  const typecheckCommand = typecheckCommandRaw && typecheckCommandRaw !== 'none' ? typecheckCommandRaw : null

  const lintCommandRaw = field('Lint Command')
  const lintCommand = lintCommandRaw && lintCommandRaw !== 'none' ? lintCommandRaw : null

  const languagesRaw = field('Languages')
  const languages = languagesRaw
    ? languagesRaw.split(',').map(l => l.trim()).filter(l => l.length > 0 && l !== 'none')
    : []

  const frameworksRaw = field('Frameworks')
  const frameworks = frameworksRaw
    ? frameworksRaw.split(',').map(f => f.trim()).filter(f => f.length > 0 && f !== 'none')
    : []

  const testRunnerRaw = field('Test Runner')
  const testRunner = testRunnerRaw && testRunnerRaw !== 'none' ? testRunnerRaw : null

  const buildToolRaw = field('Build Tool')
  const buildTool = buildToolRaw && buildToolRaw !== 'none' ? buildToolRaw : null

  const configFilesRaw = field('Config Files')
  const configFiles = configFilesRaw
    ? configFilesRaw.split(',').map(c => c.trim()).filter(c => c.length > 0 && c !== 'none')
    : []

  return {
    languages,
    frameworks,
    testRunner,
    packageManager,
    buildTool,
    configFiles,
    testCommand,
    buildCommand,
    typecheckCommand,
    lintCommand,
  }
}

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

  // Validate DAG
  validateDag(tasks)

  return { tasks, warnings: [] }
}

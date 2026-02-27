// === Iteration Log Builder (Spec 5 — FR-5) ===

import type { SwarmEvent, AgentRole } from './types.js'
import type { CodePhaseResult, IterationLogEntry, AgentInvocationRecord } from './phase-results.js'
import type { TestResult } from './test-runner.js'

// === API ===

export function buildIterationLog(
  events: SwarmEvent[],
  codeResult: CodePhaseResult
): IterationLogEntry[] {
  // Group events by iteration boundaries
  const iterationGroups: Map<number, SwarmEvent[]> = new Map()
  let currentIteration: number | null = null

  for (const event of events) {
    if (event.type === 'iteration:start') {
      currentIteration = event.data.iteration
      if (!iterationGroups.has(currentIteration)) {
        iterationGroups.set(currentIteration, [])
      }
    } else if (event.type === 'iteration:end') {
      currentIteration = null
    } else if (currentIteration !== null) {
      iterationGroups.get(currentIteration)!.push(event)
    }
  }

  const entries: IterationLogEntry[] = []

  for (const [iterationIndex, groupEvents] of iterationGroups) {
    // Correlate agent:invoke with agent:result by role
    const invokesByRole = new Map<AgentRole, { model: string }>()
    const resultsByRole = new Map<AgentRole, { durationMs: number }>()

    for (const event of groupEvents) {
      if (event.type === 'agent:invoke') {
        invokesByRole.set(event.data.role, { model: event.data.model })
      } else if (event.type === 'agent:result') {
        resultsByRole.set(event.data.role, { durationMs: event.data.durationMs })
      }
    }

    const agentsInvoked: AgentInvocationRecord[] = []
    for (const [role, invoke] of invokesByRole) {
      const result = resultsByRole.get(role)
      agentsInvoked.push({
        role,
        model: invoke.model,
        durationMs: result?.durationMs ?? 0,
      })
    }

    // Extract test results
    let testResult: TestResult | undefined
    for (const event of groupEvents) {
      if (event.type === 'test:green') {
        testResult = {
          totalTests: event.data.totalTests,
          passingTests: event.data.passingTests,
          failingTests: 0,
          durationMs: 0,
        }
      } else if (event.type === 'test:fail') {
        testResult = {
          totalTests: event.data.totalTests,
          passingTests: event.data.totalTests - event.data.failingTests,
          failingTests: event.data.failingTests,
          durationMs: 0,
        }
      }
    }

    // Count review findings
    let reviewFindingCount = 0
    for (const event of groupEvents) {
      if (event.type === 'review:findings') {
        reviewFindingCount += event.data.critical + event.data.important + event.data.suggestion
      }
    }

    // Collect files changed
    const filesChanged: string[] = []
    for (const event of groupEvents) {
      if (event.type === 'file:changed') {
        filesChanged.push(event.data.path)
      }
    }

    // Derive specItem from codeResult
    const iterState = codeResult.iterations.find(it => it.iteration === iterationIndex)
    let specItem = `Iteration ${iterationIndex}`
    if (codeResult.batches.length > 0) {
      const firstBatch = codeResult.batches[0]!
      if (firstBatch.tasks.length > 0) {
        specItem = firstBatch.tasks[0]!.title
      }
    }

    // If iteration exists in codeResult, use the task mapping
    if (iterState) {
      const commit = codeResult.gitState.commits.find(c => c.iteration === iterationIndex)
      if (commit) {
        specItem = commit.specItem
      }
    }

    entries.push({
      specItem,
      iterationIndex,
      agentsInvoked,
      testResult,
      reviewFindingCount,
      filesChanged,
    })
  }

  return entries
}

export function renderIterationLog(entries: IterationLogEntry[]): string {
  if (entries.length === 0) {
    return '# Iterations\n\nNo iterations recorded.\n'
  }

  const lines: string[] = ['# Iterations', '']

  for (const entry of entries) {
    lines.push(`## Iteration ${entry.iterationIndex}: ${entry.specItem}`)
    lines.push('')

    if (entry.agentsInvoked.length > 0) {
      lines.push('### Agents')
      lines.push('')
      for (const agent of entry.agentsInvoked) {
        lines.push(`- **${agent.role}** (${agent.model}): ${agent.durationMs}ms`)
      }
      lines.push('')
    }

    if (entry.testResult) {
      lines.push('### Test Results')
      lines.push('')
      lines.push(`- Total: ${entry.testResult.totalTests}`)
      lines.push(`- Passing: ${entry.testResult.passingTests}`)
      lines.push(`- Failing: ${entry.testResult.failingTests}`)
      lines.push('')
    }

    if (entry.reviewFindingCount > 0) {
      lines.push(`### Review Findings: ${entry.reviewFindingCount}`)
      lines.push('')
    }

    if (entry.filesChanged.length > 0) {
      lines.push('### Files Changed')
      lines.push('')
      for (const file of entry.filesChanged) {
        lines.push(`- ${file}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

// === Iteration Log Builder (Spec 5 — FR-5) ===

import type { SwarmEvent, AgentRole } from '../../core/types.js'
import type { CodePhaseResult, IterationLogEntry, AgentInvocationRecord, TestResult } from '../phase-results.js'

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
    const invocationRecords = new Map<string, AgentInvocationRecord>()
    const pendingLegacyInvokes = new Map<AgentRole, string[]>()

    for (const event of groupEvents) {
      if (event.type === 'agent:invoke') {
        const invocationId = event.correlation?.invocationId ?? `${event.data.role}:${invocationRecords.size}`
        const roleQueue = pendingLegacyInvokes.get(event.data.role) ?? []
        roleQueue.push(invocationId)
        pendingLegacyInvokes.set(event.data.role, roleQueue)
        invocationRecords.set(invocationId, {
          invocationId: event.correlation?.invocationId,
          role: event.data.role,
          model: event.data.model,
          durationMs: 0,
          taskId: event.correlation?.taskId,
          attempt: event.correlation?.attempt,
          backendSessionId: event.correlation?.backendSessionId,
        })
      } else if (event.type === 'agent:result') {
        const invocationId = event.correlation?.invocationId
          ?? pendingLegacyInvokes.get(event.data.role)?.shift()
          ?? `${event.data.role}:result:${invocationRecords.size}`
        const existing = invocationRecords.get(invocationId)
        const baseRecord: AgentInvocationRecord = existing ?? {
          role: event.data.role,
          model: 'unknown',
          durationMs: 0,
        }
        invocationRecords.set(invocationId, {
          ...baseRecord,
          invocationId: event.correlation?.invocationId ?? baseRecord.invocationId,
          taskId: event.correlation?.taskId ?? baseRecord.taskId,
          attempt: event.correlation?.attempt ?? baseRecord.attempt,
          backendSessionId: event.correlation?.backendSessionId ?? baseRecord.backendSessionId,
          durationMs: event.data.durationMs,
          tokenUsage: event.data.tokenUsage,
        })
      }
    }

    const agentsInvoked = [...invocationRecords.values()]

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
    if (codeResult.taskCompletions && codeResult.taskCompletions.length > 0) {
      specItem = codeResult.taskCompletions[0]!.title
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
        let line = `- **${agent.role}** (${agent.model}): ${agent.durationMs}ms`
        if (agent.tokenUsage) {
          const t = agent.tokenUsage
          line += ` — ${t.input.toLocaleString()} in / ${t.output.toLocaleString()} out / ${t.cacheCreation.toLocaleString()} cache_w / ${t.cacheRead.toLocaleString()} cache_r`
        }
        lines.push(line)
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

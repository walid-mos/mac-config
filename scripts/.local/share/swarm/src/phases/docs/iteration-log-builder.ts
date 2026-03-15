// === Iteration Log Builder ===

import type { SwarmEvent, AgentRole, SessionId, TokenUsage } from '../../core/types.js'
import { iterationLogArtifactSchema } from '../phase-results.js'
import type {
  CodePhaseResult,
  IterationLogArtifact,
  IterationLogEntry,
  AgentInvocationRecord,
  TestResult,
} from '../phase-results.js'

const compareStrings = (left: string, right: string): number => left.localeCompare(right, 'en', { sensitivity: 'base' })

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US').format(value)

const uniqueSorted = (values: readonly string[]): string[] => {
  return [...new Set(values)].sort(compareStrings)
}

const getSpecItemForIteration = (codeResult: CodePhaseResult, iterationIndex: number): string => {
  const commit = [...codeResult.gitState.commits]
    .sort((left, right) => left.iteration - right.iteration || compareStrings(left.specItem, right.specItem))
    .find((entry) => entry.iteration === iterationIndex)
  if (commit) {
    return commit.specItem
  }

  const completion = codeResult.taskCompletions?.find((entry) => entry.attempts === iterationIndex || entry.attempts === iterationIndex + 1)
  if (completion) {
    return completion.title
  }

  return `Iteration ${iterationIndex}`
}

export const buildIterationLog = (
  events: SwarmEvent[],
  codeResult: CodePhaseResult
): IterationLogEntry[] => {
  const iterationGroups = new Map<number, SwarmEvent[]>()
  let currentIteration: number | null = null

  for (const event of events) {
    if (event.type === 'iteration:start') {
      currentIteration = event.data.iteration
      iterationGroups.set(currentIteration, [])
      continue
    }

    if (event.type === 'iteration:end') {
      currentIteration = null
      continue
    }

    if (currentIteration === null) {
      continue
    }

    const group = iterationGroups.get(currentIteration)
    if (group) {
      group.push(event)
    }
  }

  const entries: IterationLogEntry[] = []

  for (const [iterationIndex, groupEvents] of [...iterationGroups.entries()].sort((left, right) => left[0] - right[0])) {
    const invokesByRole = new Map<AgentRole, { model: string }>()
    const resultsByRole = new Map<AgentRole, { durationMs: number; tokenUsage?: TokenUsage }>()

    for (const event of groupEvents) {
      if (event.type === 'agent:invoke') {
        invokesByRole.set(event.data.role, { model: event.data.model })
      }

      if (event.type === 'agent:result') {
        resultsByRole.set(event.data.role, {
          durationMs: event.data.durationMs,
          tokenUsage: event.data.tokenUsage,
        })
      }
    }

    const agentsInvoked: AgentInvocationRecord[] = [...invokesByRole.entries()]
      .sort((left, right) => compareStrings(left[0], right[0]))
      .map(([role, invoke]) => {
        const result = resultsByRole.get(role)
        return {
          role,
          model: invoke.model,
          durationMs: result?.durationMs ?? 0,
          ...(result?.tokenUsage ? { tokenUsage: result.tokenUsage } : {}),
        }
      })

    let testResult: TestResult | undefined
    for (const event of groupEvents) {
      if (event.type === 'test:green') {
        testResult = {
          totalTests: event.data.totalTests,
          passingTests: event.data.passingTests,
          failingTests: 0,
          durationMs: 0,
        }
      }

      if (event.type === 'test:fail') {
        testResult = {
          totalTests: event.data.totalTests,
          passingTests: event.data.totalTests - event.data.failingTests,
          failingTests: event.data.failingTests,
          durationMs: 0,
        }
      }
    }

    let reviewFindingCount = 0
    for (const event of groupEvents) {
      if (event.type === 'review:findings') {
        reviewFindingCount += event.data.critical + event.data.important + event.data.suggestion
      }
    }

    const filesChanged = uniqueSorted(
      groupEvents
        .filter((event) => event.type === 'file:changed')
        .map((event) => event.data.path)
    )

    entries.push({
      specItem: getSpecItemForIteration(codeResult, iterationIndex),
      iterationIndex,
      agentsInvoked,
      testResult,
      reviewFindingCount,
      filesChanged,
    })
  }

  return entries
}

export const buildIterationLogArtifact = (
  sessionId: SessionId,
  events: SwarmEvent[],
  codeResult: CodePhaseResult,
  generatedAt: string
): IterationLogArtifact => {
  return iterationLogArtifactSchema.parse({
    schemaVersion: 2,
    sessionId,
    generatedAt,
    entries: buildIterationLog(events, codeResult),
  }) as IterationLogArtifact
}

export const renderIterationLog = (input: IterationLogArtifact | IterationLogEntry[]): string => {
  const artifact = Array.isArray(input)
    ? iterationLogArtifactSchema.parse({
      schemaVersion: 2,
      sessionId: 'unknown-session' as SessionId,
      generatedAt: new Date(0).toISOString(),
      entries: input,
    }) as IterationLogArtifact
    : input

  if (artifact.entries.length === 0) {
    return '# Iterations\n\nNo iterations recorded.\n'
  }

  const lines: string[] = ['# Iterations', '', `- Session: ${artifact.sessionId}`, `- Generated: ${artifact.generatedAt}`, '']

  for (const entry of artifact.entries) {
    lines.push(`## Iteration ${entry.iterationIndex}: ${entry.specItem}`)
    lines.push('')

    if (entry.agentsInvoked.length > 0) {
      lines.push('### Agents')
      lines.push('')
      for (const agent of entry.agentsInvoked) {
        let line = `- **${agent.role}** (${agent.model}): ${agent.durationMs}ms`
        if (agent.tokenUsage) {
          const usage = agent.tokenUsage
          line += ` - ${formatNumber(usage.input)} in / ${formatNumber(usage.output)} out / ${formatNumber(usage.cacheCreation)} cache_w / ${formatNumber(usage.cacheRead)} cache_r`
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

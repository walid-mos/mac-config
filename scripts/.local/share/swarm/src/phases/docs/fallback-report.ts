// === Delivery Report Renderer ===

import type { DeliveryReportInput } from '../phase-results.js'

const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds}s`
}

export const generateFallbackReport = (input: DeliveryReportInput): string => {
  const lines: string[] = []
  lines.push(`# Delivery Report: ${input.sessionId}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Schema Version: ${input.schemaVersion}`)
  lines.push(`- Session: ${input.sessionId}`)
  lines.push(`- Spec: ${input.specPath}`)
  lines.push(`- Started: ${input.startedAt}`)
  lines.push(`- Completed: ${input.completedAt}`)
  lines.push(`- Duration: ${formatDuration(input.totalDuration)}`)
  lines.push(`- Spec Items: ${input.specItems.length}`)
  lines.push('')
  lines.push('## Changes')
  lines.push('')

  if (input.specItems.length === 0) {
    lines.push('No spec items were processed.')
  }

  for (const item of input.specItems) {
    lines.push(`### ${item.title} [${item.success ? 'SUCCESS' : 'FAILED'}]`)
    lines.push('')
    lines.push(`- Iterations: ${item.iterationCount}`)
    if (item.commitHash) {
      lines.push(`- Commit: ${item.commitHash}`)
    }
    lines.push('')

    if (item.tasks.length > 0) {
      lines.push('#### Tasks')
      lines.push('')
      for (const task of item.tasks) {
        lines.push(`- **${task.id}**: ${task.title} (${task.tag})`)
        for (const file of task.filesModified) {
          lines.push(`  - ${file}`)
        }
      }
      lines.push('')
    }
  }

  lines.push('## Testing')
  lines.push('')
  if (input.specItems.length === 0) {
    lines.push('No test results available.')
  }

  for (const item of input.specItems) {
    lines.push(`### ${item.title}`)
    lines.push('')
    lines.push(`- Total: ${item.testResult.totalTests}`)
    lines.push(`- Passing: ${item.testResult.passingTests}`)
    lines.push(`- Failing: ${item.testResult.failingTests}`)
    lines.push(`- Duration: ${item.testResult.durationMs}ms`)
    lines.push('')
  }

  lines.push('## Review')
  lines.push('')
  const findings = input.specItems.flatMap((item) => item.reviewFindings)
  if (findings.length === 0) {
    lines.push('No issues detected during code review.')
  }

  for (const finding of findings) {
    const location = finding.line === undefined || finding.line === null
      ? finding.file
      : `${finding.file}:${finding.line}`
    lines.push(`- **[${finding.severity}]** ${location} - ${finding.description} [${finding.resolved ? 'RESOLVED' : 'OPEN'}]`)
    if (finding.resolution) {
      lines.push(`  - Resolution: ${finding.resolution}`)
    }
  }
  lines.push('')

  lines.push('## Metrics')
  lines.push('')
  const totalTests = input.specItems.reduce((sum, item) => sum + item.testResult.totalTests, 0)
  const passingTests = input.specItems.reduce((sum, item) => sum + item.testResult.passingTests, 0)
  const failingTests = input.specItems.reduce((sum, item) => sum + item.testResult.failingTests, 0)
  const totalIterations = input.specItems.reduce((sum, item) => sum + item.iterationCount, 0)
  const successfulItems = input.specItems.filter((item) => item.success).length
  const successRate = input.specItems.length === 0 ? 0 : Math.round((successfulItems / input.specItems.length) * 100)

  lines.push(`- Total Tests: ${totalTests}`)
  lines.push(`- Passing: ${passingTests}`)
  lines.push(`- Failing: ${failingTests}`)
  lines.push(`- Iterations: ${totalIterations}`)
  lines.push(`- Success Rate: ${successRate}%`)
  lines.push(`- Duration: ${formatDuration(input.totalDuration)}`)
  lines.push('')

  return lines.join('\n')
}

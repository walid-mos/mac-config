// === Fallback Report (Spec 5 — FR-3) ===

import type { DeliveryReportInput } from '../phase-results.js'

// === API ===

export function generateFallbackReport(input: DeliveryReportInput): string {
  const lines: string[] = []

  // Header
  lines.push(`# Delivery Report: ${input.sessionId}`)
  lines.push('')

  // Summary section
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **Session**: ${input.sessionId}`)
  lines.push(`- **Spec**: ${input.specPath}`)
  lines.push(`- **Started**: ${input.startedAt}`)
  lines.push(`- **Completed**: ${input.completedAt}`)
  lines.push(`- **Duration**: ${formatDuration(input.totalDuration)}`)
  lines.push(`- **Spec Items**: ${input.specItems.length}`)
  lines.push('')

  // Changes section
  lines.push('## Changes')
  lines.push('')
  if (input.specItems.length === 0) {
    lines.push('No spec items were processed.')
  } else {
    for (const item of input.specItems) {
      const status = item.success ? 'SUCCESS' : 'FAILED'
      lines.push(`### ${item.title} [${status}]`)
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
          if (task.filesModified.length > 0) {
            for (const file of task.filesModified) {
              lines.push(`  - ${file}`)
            }
          }
        }
        lines.push('')
      }
    }
  }

  // Testing section
  lines.push('## Testing')
  lines.push('')
  if (input.specItems.length === 0) {
    lines.push('No test results available.')
  } else {
    for (const item of input.specItems) {
      lines.push(`### ${item.title}`)
      lines.push('')
      lines.push(`- Total: ${item.testResult.totalTests}`)
      lines.push(`- Passing: ${item.testResult.passingTests}`)
      lines.push(`- Failing: ${item.testResult.failingTests}`)
      lines.push(`- Duration: ${item.testResult.durationMs}ms`)
      lines.push('')
    }
  }

  // Review section
  lines.push('## Review')
  lines.push('')
  const allFindings = input.specItems.flatMap(si => si.reviewFindings)
  if (allFindings.length === 0) {
    lines.push('No issues detected during code review.')
  } else {
    for (const finding of allFindings) {
      const resolvedTag = finding.resolved ? 'RESOLVED' : 'OPEN'
      lines.push(`- **[${finding.severity}]** ${finding.description} [${resolvedTag}]`)
      if (finding.resolution) {
        lines.push(`  - Resolution: ${finding.resolution}`)
      }
    }
  }
  lines.push('')

  // Metrics section
  lines.push('## Metrics')
  lines.push('')
  const totalTests = input.specItems.reduce((acc, si) => acc + si.testResult.totalTests, 0)
  const totalPassing = input.specItems.reduce((acc, si) => acc + si.testResult.passingTests, 0)
  const totalFailing = input.specItems.reduce((acc, si) => acc + si.testResult.failingTests, 0)
  const totalIterations = input.specItems.reduce((acc, si) => acc + si.iterationCount, 0)
  const successCount = input.specItems.filter(si => si.success).length

  lines.push(`- **Total Tests**: ${totalTests}`)
  lines.push(`- **Passing**: ${totalPassing}`)
  lines.push(`- **Failing**: ${totalFailing}`)
  lines.push(`- **Iterations**: ${totalIterations}`)
  lines.push(`- **Success Rate**: ${input.specItems.length > 0 ? Math.round((successCount / input.specItems.length) * 100) : 0}%`)
  lines.push(`- **Duration**: ${formatDuration(input.totalDuration)}`)
  lines.push('')

  return lines.join('\n')
}

// === Helpers ===

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${remainingSeconds}s`
}

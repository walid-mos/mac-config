// === Doc Writer Prompt Builder (Spec 5 — FR-2) ===

import type { DeliveryReportInput } from '../phase-results.js'

// === Constants ===

const MAX_FINDING_DESCRIPTION_BYTES = 2048 // 2KB per DOC-SC-1
const MAX_PROMPT_BYTES = 256 * 1024 // 256KB per DOC-SC-1

// === API ===

export function buildDocWriterPrompt(input: DeliveryReportInput): string {
  const sections: string[] = []

  // Role description
  sections.push(
    'You are a technical writer. Your task is to produce a delivery report in markdown format.'
  )
  sections.push('')

  // Session context
  sections.push('## Session Context')
  sections.push('')
  sections.push(`- **Session ID**: ${input.sessionId}`)
  sections.push(`- **Spec Path**: ${input.specPath}`)
  sections.push(`- **Started**: ${input.startedAt}`)
  sections.push(`- **Completed**: ${input.completedAt}`)
  sections.push(`- **Duration**: ${input.totalDuration}ms`)
  sections.push('')

  // Spec item summaries
  sections.push('## Spec Items')
  sections.push('')

  for (const item of input.specItems) {
    const status = item.success ? 'SUCCESS' : 'FAILED'
    sections.push(`### ${item.title} [${status}]`)
    sections.push('')
    sections.push(`- Iterations: ${item.iterationCount}`)
    if (item.commitHash) {
      sections.push(`- Commit: ${item.commitHash}`)
    }
    sections.push('')

    // Tasks
    if (item.tasks.length > 0) {
      sections.push('#### Tasks')
      for (const task of item.tasks) {
        sections.push(`- ${task.id}: ${task.title} (${task.tag})`)
      }
      sections.push('')
    }

    // Test results
    sections.push('#### Test Results')
    sections.push(`- Total: ${item.testResult.totalTests}`)
    sections.push(`- Passing: ${item.testResult.passingTests}`)
    sections.push(`- Failing: ${item.testResult.failingTests}`)
    sections.push(`- Duration: ${item.testResult.durationMs}ms`)
    sections.push('')

    // Review findings
    if (item.reviewFindings.length > 0) {
      sections.push('#### Review Findings')
      for (const finding of item.reviewFindings) {
        const description = truncateToBytes(finding.description, MAX_FINDING_DESCRIPTION_BYTES)
        const resolvedTag = finding.resolved ? 'RESOLVED' : 'OPEN'
        sections.push(`- **[${finding.severity}]** ${description} [${resolvedTag}]`)
        if (finding.resolution) {
          sections.push(`  - Resolution: ${finding.resolution}`)
        }
      }
      sections.push('')
    }
  }

  // Output format instructions
  sections.push('## Output Format Instructions')
  sections.push('')
  sections.push('Produce a markdown document with the following sections:')
  sections.push('1. **Summary** - Overview of the session and outcome')
  sections.push('2. **Changes** - What was implemented, files modified')
  sections.push('3. **Testing** - Test results, pass/fail counts')
  sections.push('4. **Review** - Code review findings and resolutions')
  sections.push('5. **Metrics** - Duration, iteration counts, success rates')
  sections.push('')
  sections.push('Use proper markdown formatting with headers, lists, and tables where appropriate.')
  sections.push('')

  let prompt = sections.join('\n')

  // Enforce 256KB total prompt limit
  const byteLength = Buffer.byteLength(prompt, 'utf8')
  if (byteLength > MAX_PROMPT_BYTES) {
    // Truncate to fit within limit while preserving valid UTF-8
    prompt = truncateToBytes(prompt, MAX_PROMPT_BYTES)
  }

  return prompt
}

// === Helpers ===

function truncateToBytes(str: string, maxBytes: number): string {
  const buf = Buffer.from(str, 'utf8')
  if (buf.length <= maxBytes) return str

  // Truncate the buffer, then decode back to string
  // This may cut in the middle of a multi-byte character, so we find
  // the last valid character boundary
  const truncated = buf.subarray(0, maxBytes)
  return truncated.toString('utf8').replace(/\uFFFD$/, '')
}

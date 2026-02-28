// === Code Agent Prompt Builder (Spec 4 — FR-2, FR-4) ===

import type { TechStack } from '../../detect/tech-stack.js'
import type { PlannerTask } from '../plan/task-parser.js'
import type { ReviewFinding } from '../phase-results.js'

// === Constants ===

const MAX_FINDINGS_BYTES = 32_768 // 32KB (DL-SC-7)

// === API ===

export function buildCodeAgentPrompt(
  task: PlannerTask,
  testFiles: string[],
  techStack: TechStack,
  previousFindings?: ReviewFinding[]
): string {
  const sections: string[] = []

  // Role section
  sections.push('# Role\n\nYou are a code implementation agent. Write production-quality code that passes all tests and follows coding conventions.')

  // Task details
  sections.push(`# Task\n\n- **ID**: ${task.id}\n- **Title**: ${task.title}\n- **Description**: ${task.description}`)

  // Files
  sections.push(`# Files\n\n${task.files.map(f => `- ${f}`).join('\n')}`)

  // Test hints
  if (task.testHints.length > 0) {
    sections.push(`# Test Hints\n\n${task.testHints.map(h => `- ${h}`).join('\n')}`)
  }

  // Test files
  if (testFiles.length > 0) {
    sections.push(`# Test Files\n\n${testFiles.map(f => `- ${f}`).join('\n')}`)
  }

  // Tech stack
  sections.push(`# Tech Stack\n\n- Languages: ${techStack.languages.join(', ')}\n- Frameworks: ${techStack.frameworks.join(', ')}\n- Test runner: ${techStack.testRunner ?? 'none'}\n- Package manager: ${techStack.packageManager}\n- Build tool: ${techStack.buildTool ?? 'none'}\n- Test command: ${techStack.testCommand}`)

  // Previous findings (iteration 2+)
  if (previousFindings && previousFindings.length > 0) {
    let findingsText = previousFindings.map(f =>
      `- [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ''} (${f.category}): ${f.description}${f.suggestedFix ? ` — Fix: ${f.suggestedFix}` : ''}`
    ).join('\n')

    // Truncate per DL-SC-7
    if (Buffer.byteLength(findingsText, 'utf-8') > MAX_FINDINGS_BYTES) {
      findingsText = Buffer.from(findingsText, 'utf-8').subarray(0, MAX_FINDINGS_BYTES).toString('utf-8')
      findingsText += '\n\n[Findings truncated — 32KB limit reached]'
    }

    sections.push(`# Previous Review Findings\n\nAddress these findings from the previous iteration:\n\n${findingsText}`)
  }

  // Constraints
  sections.push('# Constraints\n\n- Follow existing code patterns and conventions\n- Write minimal, focused code\n- Handle errors properly\n- Type everything — no `any` types\n- Guard clauses (early returns) over nested ifs')

  // Output format
  sections.push(`# Output Format\n\nReturn valid JSON matching this structure:\n\n\`\`\`json\n{\n  "taskId": "${task.id}",\n  "status": "completed" | "failed" | "blocked",\n  "filesModified": ["string"],\n  "filesCreated": ["string"],\n  "sanityChecksPassed": true | false,\n  "sanityErrors": ["string"] // only when status is "failed" or "blocked"\n}\n\`\`\``)

  return sections.join('\n\n')
}

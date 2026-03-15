// === Code Agent Prompt Builder (Spec 4 — FR-2, FR-4) ===

import type { TechStack } from '../../detect/tech-stack.js'
import type { PlannerTask } from '../plan/task-parser.js'
import type { ReviewFinding } from '../phase-results.js'
import { buildStructuredJsonOutputSection, renderTechStackSection } from './agent-prompt-shared.js'

// === Constants ===

const MAX_FINDINGS_BYTES = 32_768 // 32KB (DL-SC-7)

// === API ===

export function buildCodeAgentPrompt(
  task: PlannerTask,
  testFiles: string[],
  techStack: TechStack,
  previousFindings?: ReviewFinding[],
  decisionLog: string = ''
): string {
  const sections: string[] = []

  // Role section
  sections.push('# Role\n\nYou are a code implementation agent. Write production-quality code that passes all tests and follows coding conventions.')

  // Task details
  sections.push(`# Task\n\n- **ID**: ${task.id}\n- **Title**: ${task.title}\n- **Description**: ${task.description}`)

  // Test hints
  if (task.testHints.length > 0) {
    sections.push(`# Test Hints\n\n${task.testHints.map(h => `- ${h}`).join('\n')}`)
  }

  // Test files
  if (testFiles.length > 0) {
    sections.push(`# Test Files\n\n${testFiles.map(f => `- ${f}`).join('\n')}`)
  }

  // Tech stack
  sections.push(renderTechStackSection(techStack))

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

  // Decision log from previous iterations (prevents flip-flop)
  if (decisionLog) {
    sections.push(decisionLog)
  }

  // Constraints
  sections.push(`# Constraints\n\n- Focus on implementing the task described above. Other tasks are handled by other agents — avoid implementing functionality that belongs to a different task.\n- Follow existing code patterns and conventions\n- Write minimal, focused code\n- Handle errors properly\n- Type everything — no \`any\` types\n- Guard clauses (early returns) over nested ifs\n- Implement all changes by writing files directly — do not just describe changes\n- When a dependency is needed: if the project has a bundler, install it via the package manager (e.g., \`pnpm add <pkg>\`) and import it. If no bundler, CDN is acceptable — use HTTPS and add Subresource Integrity (SRI) hashes.\n- NEVER delete functionality that the spec requires. If a review finding conflicts with the spec, find a way to satisfy BOTH — do not simply remove the feature.`)

  // Execution section — agent runs tests and builds itself
  const executionLines: string[] = ['# Execution', '', 'You MUST run tests and build after making changes — do NOT just write code and stop.']

  executionLines.push('', '## Test Execution', `- Run: ${techStack.testCommand}`, '- If tests fail, read the output, fix your code, and re-run until ALL tests pass', '- Do NOT report back with failing tests — iterate until green')

  if (techStack.buildCommand) {
    executionLines.push('', '## Build Execution', `- Run: ${techStack.buildCommand}`, '- If build fails, read errors, fix, and re-run until it succeeds', '- A passing test suite with a broken build is NOT acceptable')
  }

  if (techStack.typecheckCommand) {
    executionLines.push('', '## Type Check Execution', `- Run: ${techStack.typecheckCommand}`, '- If type errors appear, fix your code and re-run until clean', '- A passing test suite with type errors is NOT acceptable')
  }

  if (techStack.lintCommand) {
    executionLines.push('', '## Lint Execution', `- Run: ${techStack.lintCommand}`, '- If lint errors appear, fix your code and re-run until clean', '- Do NOT disable lint rules — fix the underlying issue')
  }

  executionLines.push('', buildStructuredJsonOutputSection('## Output\nWhen done, output this JSON block:', '{ "filesChanged": ["path/to/file.ts"], "testResult": { "totalTests": 0, "passingTests": 0, "failingTests": 0 }, "buildResult": { "success": true, "error": null }, "summary": "Brief description of changes" }'))

  sections.push(executionLines.join('\n'))

  // Handling review findings
  sections.push(`# Handling Review Findings\n\nWhen addressing review findings from previous iterations:\n1. Read the \`suggestedFix\` — if it names a file and a specific change, implement it.\n2. If the fix is vague, use the \`file\` and \`description\` fields to determine what to change. Apply standard best practices for the \`category\`.\n3. If a finding conflicts with spec requirements:\n   - NEVER remove spec-required functionality to satisfy a finding\n   - Instead, fix the ENVIRONMENT (config, settings, framework setup) to make the spec-required feature work correctly\n4. Findings prefixed \`[RECURRING]\` failed to be fixed in previous iterations. Try a DIFFERENT approach than what was attempted before.`)

  return sections.join('\n\n')
}

// === Finding Fix Prompt (concise — for resumed agents that already have full context) ===

const SEVERITY_ORDER: Record<ReviewFinding['severity'], number> = {
  critical: 0,
  important: 1,
  suggestion: 2,
}

export function buildFindingFixPrompt(
  findings: ReviewFinding[],
  decisionLog: string = ''
): string {
  const sections: string[] = []

  sections.push('# Fix Required')

  // Group findings by severity
  const grouped = new Map<ReviewFinding['severity'], ReviewFinding[]>()
  for (const f of findings) {
    const list = grouped.get(f.severity) ?? []
    list.push(f)
    grouped.set(f.severity, list)
  }

  // Output in severity order
  const sortedSeverities = [...grouped.keys()].sort(
    (a, b) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b]
  )

  for (const severity of sortedSeverities) {
    const items = grouped.get(severity)!
    const label = severity.charAt(0).toUpperCase() + severity.slice(1)
    const lines = items.map(f => {
      const loc = f.line ? `${f.file}:${f.line}` : f.file
      const fix = f.suggestedFix ? `\n  Suggested fix: ${f.suggestedFix}` : ''
      return `- ${loc} [${f.category}] — ${f.description}${fix}`
    })
    sections.push(`## ${label}\n${lines.join('\n')}`)
  }

  sections.push('Fix ONLY these issues. Run tests after fixing.')

  // Decision log from previous iterations (prevents flip-flop)
  if (decisionLog) {
    sections.push(decisionLog)
  }

  sections.push(buildStructuredJsonOutputSection('## Output', '{ "filesChanged": [...], "testResult": {...}, "buildResult": {...}, "summary": "..." }'))

  return sections.join('\n\n')
}

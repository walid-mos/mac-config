// === Planner Prompt Builder (Spec 3 — FR-2) ===

import type { ReviewFinding } from '../phase-results.js'

// === API ===

export function buildPlannerPrompt(
  specItemContent: string,
  projectStructure: string[]
): string {
  const lines: string[] = []

  // Role description
  lines.push('# Role')
  lines.push('')
  lines.push('You are a senior software architect and planner. Your task is to decompose a feature specification into an ordered set of implementation tasks.')
  lines.push('')

  // Spec content
  lines.push('# Specification')
  lines.push('')
  lines.push(specItemContent.trim())
  lines.push('')

  // Project structure
  lines.push('# Project Structure')
  lines.push('')
  for (const entry of projectStructure) {
    lines.push(`- ${entry}`)
  }
  lines.push('')

  // Constraints
  lines.push('# Constraints')
  lines.push('')
  lines.push('1. Each task MUST have a tag: `backend`, `frontend`, or `fullstack`.')
  lines.push('2. Tasks MUST form a valid DAG — no circular dependencies allowed.')
  lines.push('3. Each task ID must follow the format `TASK-N` where N is a positive integer.')
  lines.push('4. Each task should cover a distinct domain/concern — parallel tasks should NOT need to modify the same files.')
  lines.push('5. Task titles MUST be functional, user-facing descriptions of WHAT the feature does — NOT technical file names or component names.')
  lines.push('   - BAD:  "Create BaseLayout.astro", "Add Header component", "Implement UserService.ts"')
  lines.push('   - GOOD: "Set up base page layout with metadata", "Add site navigation with responsive menu", "Handle user authentication and sessions"')
  lines.push('')

  // Output format
  lines.push('# Output Format')
  lines.push('')
  lines.push('You MUST produce output in this exact rigid markdown template format.')
  lines.push('First, analyze the project to detect its tech stack, then decompose the spec into tasks.')
  lines.push('')
  lines.push('```markdown')
  lines.push('## Tech Stack')
  lines.push('- **Package Manager**: <detect from lockfile: pnpm-lock.yaml → pnpm, yarn.lock → yarn, bun.lock → bun, package-lock.json → npm>')
  lines.push('- **Test Command**: <full command to run tests, e.g., "pnpm test" or "pnpm exec vitest run">')
  lines.push('- **Build Command**: <full command to build, or "none">')
  lines.push('- **Typecheck Command**: <full command to type-check, e.g. "pnpm exec tsc --noEmit", or "none">')
  lines.push('- **Lint Command**: <full command to lint, e.g. "pnpm exec eslint .", or "none">')
  lines.push('- **Languages**: <comma-separated>')
  lines.push('- **Frameworks**: <comma-separated or "none">')
  lines.push('- **Test Runner**: <name or "none">')
  lines.push('- **Build Tool**: <name or "none">')
  lines.push('- **Config Files**: <comma-separated list of detected config files>')
  lines.push('')
  lines.push('## Task Decomposition')
  lines.push('')
  lines.push('### TASK-1: <title>')
  lines.push('- **Tag**: backend | frontend | fullstack')
  lines.push('- **Dependencies**: none | TASK-X, TASK-Y')
  lines.push('- **Description**: <detailed description of what to implement>')
  lines.push('- **Test hints**: <what tests should verify>')
  lines.push('')
  lines.push('  Test hints MUST describe BEHAVIOR to verify, not just existence checks:')
  lines.push('  - BAD:  "Test that component exists"')
  lines.push('  - GOOD: "Test that nav contains links to all spec-defined sections; verify each anchor target has a matching id"')
  lines.push('  - BAD:  "Test that CSS is loaded"')
  lines.push('  - GOOD: "Test that no inline style attributes are used; verify external stylesheet URL is HTTPS"')
  lines.push('```')
  lines.push('')
  lines.push('Repeat the `### TASK-N` block for each task.')
  lines.push('')

  // Command format rules
  lines.push('## Command Format Rules')
  lines.push('')
  lines.push('- testCommand, buildCommand, typecheckCommand, and lintCommand must be plain shell commands — NO markdown, NO backticks, NO parenthetical explanations')
  lines.push('- GOOD: "pnpm test", "pnpm build"')
  lines.push('- BAD: "`pnpm test` (runs `vitest run`)", "pnpm build -- builds the project"')

  return lines.join('\n')
}

export function buildFindingsFixPlannerPrompt(
  findings: ReviewFinding[],
  decisionLog: string,
  specContext: string,
  projectStructure: string[]
): string {
  const lines: string[] = []

  lines.push('# Role')
  lines.push('')
  lines.push('You are a senior software architect. Your task is to group review findings into a minimal set of implementation tasks. Related findings that touch the same file or concern should be combined into a single task. Trivial 1-line fixes can be grouped together.')
  lines.push('')

  lines.push('# Original Specification (for context)')
  lines.push('')
  lines.push(specContext.trim())
  lines.push('')

  if (decisionLog) {
    lines.push(decisionLog)
    lines.push('')
  }

  lines.push('# Review Findings to Fix')
  lines.push('')
  for (const f of findings) {
    if (f.severity !== 'critical' && f.severity !== 'important') continue
    lines.push(`## ${f.file}${f.line ? `:${f.line}` : ''} — ${f.severity} ${f.category}`)
    lines.push(f.description)
    if (f.suggestedFix) lines.push(`Suggested fix: ${f.suggestedFix}`)
    lines.push('')
  }

  lines.push('# Project Structure')
  lines.push('')
  for (const entry of projectStructure) {
    lines.push(`- ${entry}`)
  }
  lines.push('')

  lines.push('# Constraints')
  lines.push('')
  lines.push('1. Each task MUST have a tag: `backend`, `frontend`, or `fullstack`.')
  lines.push('2. Tasks MUST form a valid DAG — no circular dependencies allowed.')
  lines.push('3. Each task ID must follow the format `TASK-N` where N is a positive integer starting at 900 (to avoid collision with original plan tasks).')
  lines.push('4. **Group aggressively** — if 5 findings all affect the same file or the same concern, they belong in ONE task. The goal is fewer, larger tasks — not a 1:1 mapping.')
  lines.push('5. Task titles MUST be functional descriptions of WHAT to fix.')
  lines.push('')

  lines.push('# Output Format')
  lines.push('')
  lines.push('You MUST produce output in this exact rigid markdown template format.')
  lines.push('Do NOT include a Tech Stack section — reuse the existing one from the original plan.')
  lines.push('')
  lines.push('```markdown')
  lines.push('## Task Decomposition')
  lines.push('')
  lines.push('### TASK-900: <title>')
  lines.push('- **Tag**: backend | frontend | fullstack')
  lines.push('- **Dependencies**: none | TASK-X, TASK-Y')
  lines.push('- **Description**: <what to fix and why>')
  lines.push('- **Test hints**: <what tests should verify the fix>')
  lines.push('```')
  lines.push('')
  lines.push('Repeat the `### TASK-N` block for each task.')

  return lines.join('\n')
}

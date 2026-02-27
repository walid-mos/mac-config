// === Planner Prompt Builder (Spec 3 — FR-2) ===

import type { TechStack } from '../tech-stack.js'

// === API ===

export function buildPlannerPrompt(
  specItemContent: string,
  techStack: TechStack,
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

  // Tech stack
  lines.push('# Tech Stack')
  lines.push('')
  lines.push(`- **Languages**: ${techStack.languages.join(', ') || 'none detected'}`)
  lines.push(`- **Frameworks**: ${techStack.frameworks.join(', ') || 'none detected'}`)
  lines.push(`- **Test Runner**: ${techStack.testRunner ?? 'none detected'}`)
  lines.push(`- **Package Manager**: ${techStack.packageManager}`)
  lines.push(`- **Build Tool**: ${techStack.buildTool ?? 'none detected'}`)
  lines.push(`- **Config Files**: ${techStack.configFiles.join(', ') || 'none'}`)
  lines.push(`- **Test Command**: ${techStack.testCommand}`)
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
  lines.push('2. File paths MUST be relative (no absolute paths starting with `/`).')
  lines.push('3. Tasks MUST form a valid DAG — no circular dependencies allowed.')
  lines.push('4. Files MUST be non-overlapping (disjoint) across parallel tasks. If two independent tasks share a file, they must be serialized via a dependency edge.')
  lines.push('5. Each task ID must follow the format `TASK-N` where N is a positive integer.')
  lines.push('')

  // Output format
  lines.push('# Output Format')
  lines.push('')
  lines.push('You MUST produce output in this exact rigid markdown template format:')
  lines.push('')
  lines.push('```markdown')
  lines.push('## Task Decomposition')
  lines.push('')
  lines.push('### TASK-1: <title>')
  lines.push('- **Tag**: backend | frontend | fullstack')
  lines.push('- **Files**: file1.ts, file2.ts')
  lines.push('- **Dependencies**: none | TASK-X, TASK-Y')
  lines.push('- **Description**: <text>')
  lines.push('- **Test hints**: <text>')
  lines.push('```')
  lines.push('')
  lines.push('Repeat the `### TASK-N` block for each task.')

  return lines.join('\n')
}

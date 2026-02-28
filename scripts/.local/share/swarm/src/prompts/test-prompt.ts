// === Test Prompt Builder (Spec 3 — FR-5) ===

import type { TechStack } from '../tech-stack.js'
import type { PlannerTask } from '../task-parser.js'

// === API ===

export function buildTestPrompt(
  plannerOutput: string,
  tasks: PlannerTask[],
  techStack: TechStack,
  testConventions: string[]
): string {
  const lines: string[] = []

  // Role description
  lines.push('# Role')
  lines.push('')
  lines.push('You are a TDD test engineer and test writer. Your task is to write failing tests (RED phase) for each implementation task. The tests must be syntactically valid but MUST fail when run — they must not pass until the implementation code is written.')
  lines.push('')

  // Tech stack info
  lines.push('# Tech Stack')
  lines.push('')
  lines.push(`- **Test Runner**: ${techStack.testRunner ?? 'not detected'}`)
  lines.push(`- **Languages**: ${techStack.languages.join(', ') || 'none'}`)
  lines.push(`- **Frameworks**: ${techStack.frameworks.join(', ') || 'none'}`)
  lines.push(`- **Test Command**: ${techStack.testCommand}`)
  lines.push('')

  // Planner output
  lines.push('# Planner Output')
  lines.push('')
  lines.push(plannerOutput.trim())
  lines.push('')

  // Task descriptions
  lines.push('# Tasks to Test')
  lines.push('')
  for (const task of tasks) {
    lines.push(`## ${task.id}: ${task.title}`)
    lines.push(`- **Tag**: ${task.tag}`)
    lines.push(`- **Files**: ${task.files.join(', ')}`)
    lines.push(`- **Description**: ${task.description}`)
    lines.push(`- **Test hints**: ${task.testHints.join(', ')}`)
    lines.push('')
  }

  // Testing conventions
  lines.push('# Testing Conventions')
  lines.push('')
  for (const convention of testConventions) {
    lines.push(`- ${convention}`)
  }
  lines.push('')

  // Constraints
  lines.push('# Constraints')
  lines.push('')
  lines.push('1. All tests MUST fail in the RED phase — they must not pass until implementation code is written.')
  lines.push('2. Tests must be syntactically valid — they must compile and be parseable by the test runner.')
  lines.push('3. Write one test file per task. The test file location and directory structure should follow the project conventions.')
  lines.push('4. Use describe/it/expect patterns appropriate for the test runner.')
  lines.push('5. Test file paths should be relative to the project root.')

  return lines.join('\n')
}

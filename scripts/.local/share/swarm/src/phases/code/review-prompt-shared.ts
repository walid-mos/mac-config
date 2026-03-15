import type { TestResult } from '../phase-results.js'

export interface SharedReviewPromptOpts {
  changedFiles: string[]
  specPath: string
  testResult: TestResult
  decisionLogPath?: string
  iterationIndex: number
  projectContextLine: string
}

export const buildIterationAwarenessSection = (iterationIndex: number): string => [
  '# Iteration Awareness',
  '',
  `This is review iteration ${iterationIndex}. Previous iterations already identified and addressed multiple findings`,
  '(see Decision Log above).',
  '',
  'Rules for late iterations:',
  '- Severity is INTRINSIC to the finding. A suggestion on iteration 1 does NOT become important on',
  '  iteration 5 just because it persists. The severity reflects the IMPACT, not how many times you\'ve',
  '  seen the codebase.',
  '- Do NOT re-raise findings from a different angle if the Decision Log shows they were already addressed.',
  '  "Missing null check" addressed in iteration 2 should not reappear as "potential undefined access" in',
  '  iteration 5 - that\'s the same issue rephrased.',
  '- Do NOT flag files under `.swarm/` - those are session artifacts, not project code.',
  '- If you have zero genuinely new findings, return an empty findings array. That is the CORRECT outcome -',
  '  it means the code has converged.',
  '',
].join('\n')

export const buildFileReferenceInstructions = ({
  changedFiles,
  specPath,
  decisionLogPath,
  projectContextLine,
}: SharedReviewPromptOpts): string => {
  const lines: string[] = [
    '# How to Access Content',
    '',
    '## Git Diff',
    'Run the following command to see all changes:',
    '```',
    `git diff HEAD -- ${changedFiles.join(' ')}`,
    '```',
    '',
    '## Spec',
    `Read the spec file at: \`${specPath}\``,
    '',
    '## Project Context',
    projectContextLine,
    '',
  ]

  if (decisionLogPath) {
    lines.push('## Decision Log', `Read the decision log at: \`${decisionLogPath}\``, '')
  }

  return lines.join('\n')
}

export const buildTestResultSection = ({
  totalTests,
  passingTests,
  failingTests,
  durationMs,
}: TestResult): string => (
  `# Test Results\n\n- Total: ${totalTests}\n- Passing: ${passingTests}\n- Failing: ${failingTests}\n- Duration: ${durationMs}ms`
)

export const buildReviewJsonOutputSection = (): string => (
  '# Output Format\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.\n\nReturn a JSON object with this structure:\n\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code" | "spec-compliance",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ]\n}\n\nAll string values in JSON must use proper JSON escaping - newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.'
)

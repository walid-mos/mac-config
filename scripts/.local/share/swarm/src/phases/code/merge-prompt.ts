// === Merge Agent Prompt Builder (Spec 4 — FR-7) ===

import type { ReviewFinding } from '../phase-results.js'

// === API ===

export function buildMergePrompt(
  findingsArrays: ReviewFinding[][],
  iterationIndex: number = 0,
  decisionLog: string = '',
  findingTrajectory: string = ''
): string {
  const sections: string[] = []

  // Role
  sections.push('# Role\n\nYou are a review merger agent. Consolidate and deduplicate findings from the code review, security review, and consistency review into a single merged review.')

  // Structured findings from each reviewer
  const labels = ['Code Review', 'Security Review', 'Consistency Review']
  for (let i = 0; i < findingsArrays.length; i++) {
    const label = labels[i] ?? `Review ${i + 1}`
    const findings = findingsArrays[i] ?? []
    sections.push(`# ${label} Findings\n\n${JSON.stringify(findings, null, 2)}`)
  }

  // Deduplication instructions
  sections.push('# Deduplication Instructions\n\n- Identify duplicate findings by matching file + line + category\n- When findings overlap, keep the most severe version\n- Preserve all unique findings from all three reviews\n- Count criticalCount, importantCount, and suggestionCount accurately')

  // Finding enhancement
  sections.push('# Finding Enhancement\n\nImprove vague findings during merge:\n- If both reviews flagged the same issue with different detail levels, keep the MORE detailed version\n- If a `suggestedFix` doesn\'t mention a file path or specific change, enhance it using context from both reviews\n- NEVER output a finding whose `suggestedFix` is just "fix the issue" or similarly vague — always include the target file and what to change')

  // Decision log from previous iterations
  if (decisionLog) {
    sections.push(decisionLog)
  }

  // Convergence assessment (when iterationIndex > 0)
  if (iterationIndex > 0) {
    const trajectoryBlock = findingTrajectory
      ? `\nFinding trajectory from previous waves:\n${findingTrajectory}\n`
      : ''

    sections.push([
      '# Convergence Assessment',
      '',
      'After merging findings, assess whether another code iteration would be productive.',
      '',
      'You MUST output a `convergenceRecommendation` field: "continue" or "converged".',
      trajectoryBlock,
      'Decision rules:',
      '- "continue": remaining critical/important findings describe NEW, actionable issues not previously',
      '  addressed. The code agent can make meaningful progress.',
      '- "converged": remaining findings are (a) variations of previously-addressed issues, (b) theoretical',
      '  edge cases unlikely in practice, (c) stylistic preferences, or (d) only suggestions. Another',
      '  iteration would produce diminishing returns.',
      '- If the finding trajectory shows a plateau (same count for 2+ waves), recommend "converged" — the',
      '  system is oscillating, not improving.',
      '- If all remaining blocking findings are marked [RECURRING] in the decision log, recommend "converged".',
      '- When in doubt, ask: "Would a senior engineer block this PR for these remaining findings?" If no →',
      '  "converged".',
    ].join('\n'))
  }

  // Output format
  const convergenceField = iterationIndex > 0
    ? ',\n  "convergenceRecommendation": "continue" | "converged"'
    : ''
  sections.push(`# Output Format\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.\n\nReturn a JSON object with this structure:\n\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ],\n  "criticalCount": number,\n  "importantCount": number,\n  "suggestionCount": number${convergenceField}\n}\n\nAll string values in JSON must use proper JSON escaping — newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.`)

  return sections.join('\n\n')
}

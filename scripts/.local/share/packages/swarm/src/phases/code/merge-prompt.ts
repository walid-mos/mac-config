// === Merge Agent Prompt Builder (Spec 4 — FR-7) ===

import type { ReviewFinding } from '../phase-results.js'

// === API ===

export function buildMergePrompt(
  findingsArrays: ReviewFinding[][]
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

  // Output format
  sections.push('# Output Format\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.\n\nReturn a JSON object with this structure:\n\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ],\n  "criticalCount": number,\n  "importantCount": number,\n  "suggestionCount": number\n}\n\nAll string values in JSON must use proper JSON escaping — newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.')

  return sections.join('\n\n')
}

// === Merge Agent Prompt Builder (Spec 4 — FR-7) ===

// === API ===

export function buildMergePrompt(
  codeReviewOutput: string,
  securityReviewOutput: string
): string {
  const sections: string[] = []

  // Role
  sections.push('# Role\n\nYou are a review merger agent. Consolidate and deduplicate findings from the code review and security review into a single merged review.')

  // Code review output
  sections.push(`# Code Review Output\n\n\`\`\`json\n${codeReviewOutput}\n\`\`\``)

  // Security review output
  sections.push(`# Security Review Output\n\n\`\`\`json\n${securityReviewOutput}\n\`\`\``)

  // Deduplication instructions
  sections.push('# Deduplication Instructions\n\n- Identify duplicate findings by matching file + line + category\n- When findings overlap, keep the most severe version\n- Preserve all unique findings from both reviews\n- Count criticalCount, importantCount, and suggestionCount accurately')

  // Output format
  sections.push('# Output Format\n\nReturn valid JSON matching this structure:\n\n```json\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ],\n  "criticalCount": number,\n  "importantCount": number,\n  "suggestionCount": number\n}\n```')

  return sections.join('\n\n')
}

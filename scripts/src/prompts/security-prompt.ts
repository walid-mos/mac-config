// === Security Review Prompt Builder (Spec 4 — FR-6) ===

import type { TestResult } from '../test-runner.js'

// === API ===

export function buildSecurityPrompt(
  diff: string,
  specItemContext: string,
  testResult: TestResult
): string {
  const sections: string[] = []

  // Role
  sections.push('# Role\n\nYou are a security review agent. Analyze the following code changes with focus on OWASP Top 10 vulnerabilities, injection risks, authentication/authorization issues, XSS, and other security concerns.')

  // Git diff
  sections.push(`# Git Diff\n\n\`\`\`diff\n${diff}\n\`\`\``)

  // Spec context
  sections.push(`# Spec Context\n\n${specItemContext}`)

  // Test results
  sections.push(`# Test Results\n\n- Total: ${testResult.totalTests}\n- Passing: ${testResult.passingTests}\n- Failing: ${testResult.failingTests}\n- Duration: ${testResult.durationMs}ms`)

  // Output format
  sections.push('# Output Format\n\nReturn valid JSON with an array of findings:\n\n```json\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ]\n}\n```')

  return sections.join('\n\n')
}

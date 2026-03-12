// === Review Prompt Builder (Spec 4 — FR-6) ===

import type { TestResult } from '../phase-results.js'

// === Types ===

export interface ReviewPromptOpts {
  changedFiles: string[]
  specPath: string
  testResult: TestResult
  decisionLogPath?: string
  iterationIndex: number
}

// === Helpers ===

function buildIntegrationRules(): string {
  const rules: string[] = [
    '# Integration & Build Compatibility Review',
    '',
    '## External Resources',
    '- If the project uses a bundler, check whether external CDN resources actually work with the build pipeline. Some CDN scripts are fine (analytics, fonts), others conflict with bundling.',
    '- If a CDN dependency has an equivalent npm package AND the project uses a bundler, suggest installing via the package manager as an IMPROVEMENT — not a hard block.',
    '- Never flag external resources that the spec explicitly requires.',
    '',
    '## Dependency Integrity',
    '- Flag imports/requires that reference packages not listed in package.json.',
    '- Flag dead dependencies (in package.json but never imported).',
    '- Check that framework-specific integrations use the correct adapter (e.g., `@astrojs/tailwind` for Astro).',
    '',
    '## Build Tool Compatibility',
    '- Check that code patterns are compatible with the detected build tool.',
    '- Flag CommonJS `require()` in ESM-only projects.',
    '- Flag hardcoded `localhost` URLs that should use environment variables.',
    '',
    '## Spec Compliance',
    '',
    'Read the spec context carefully. For EACH requirement described in the spec, verify the implementation satisfies it:',
    '- If the spec says "link to X" — verify the link exists AND its target exists',
    '- If the spec says "section with title Y" — verify the section and title are present',
    '- If the spec requires external resources — verify they work with the project\'s build/dev setup (check framework configs)',
    '- If the spec describes accessibility requirements — verify landmarks, ARIA attributes, keyboard navigation',
    '',
    'Flag any gap between spec and implementation as category `spec-compliance`.',
    '',
  ]


  return rules.join('\n')
}

// === Helpers ===

function buildIterationAwareness(iterationIndex: number): string {
  return [
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
    '  iteration 5 — that\'s the same issue rephrased.',
    '- Do NOT flag files under `.swarm/` — those are session artifacts, not project code.',
    '- If you have zero genuinely new findings, return an empty findings array. That is the CORRECT outcome —',
    '  it means the code has converged.',
    '',
  ].join('\n')
}

function buildFileReferenceInstructions(opts: ReviewPromptOpts): string {
  const lines: string[] = [
    '# How to Access Content',
    '',
    '## Git Diff',
    'Run the following command to see all changes:',
    '```',
    `git diff HEAD -- ${opts.changedFiles.join(' ')}`,
    '```',
    '',
    '## Spec',
    `Read the spec file at: \`${opts.specPath}\``,
    '',
    '## Project Context',
    'Read `package.json` for dependencies. Check config files (tsconfig.json, vite.config.ts, astro.config.mjs, etc.) for build setup.',
    '',
  ]

  if (opts.decisionLogPath) {
    lines.push(
      '## Decision Log',
      `Read the decision log at: \`${opts.decisionLogPath}\``,
      '',
    )
  }

  return lines.join('\n')
}

// === API ===

export function buildReviewPrompt(opts: ReviewPromptOpts): string {
  const sections: string[] = []

  // Role
  sections.push('# Role\n\nYou are a code review agent. Review the following code changes for bugs, quality issues, performance problems, integration conflicts, and adherence to best practices.')

  // File reference instructions (replaces inlined diff, spec, project context, decision log)
  sections.push(buildFileReferenceInstructions(opts))

  // Changed files list
  sections.push(`# Changed Files\n\n${opts.changedFiles.map(f => `- ${f}`).join('\n')}`)

  // Integration & build compatibility rules
  sections.push(buildIntegrationRules())

  // Test results
  sections.push(`# Test Results\n\n- Total: ${opts.testResult.totalTests}\n- Passing: ${opts.testResult.passingTests}\n- Failing: ${opts.testResult.failingTests}\n- Duration: ${opts.testResult.durationMs}ms`)

  // Iteration awareness (appended at iteration >= 2)
  if (opts.iterationIndex >= 2) {
    sections.push(buildIterationAwareness(opts.iterationIndex))
  }

  // DRY enforcement
  sections.push('# DRY Enforcement\n\nDRY violations with 3 or more repetitions of the same string/pattern are severity `important`, NOT `suggestion`. Repeated class strings, duplicated logic blocks, and copy-pasted constants that appear 3+ times MUST be flagged as `important` with category `dry-violation`. The code agent MUST fix them.')

  // Fix quality
  sections.push('# Fix Quality\n\nEvery `suggestedFix` MUST be actionable — include the target file, the specific change, and why.\nBAD:  "Fix the link." / "Add missing element."\nGOOD: Specific file + what to add/change + where in the file.')

  // Output format
  sections.push('# Output Format\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.\n\nReturn a JSON object with this structure:\n\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code" | "spec-compliance",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ]\n}\n\nAll string values in JSON must use proper JSON escaping — newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.')

  return sections.join('\n\n')
}

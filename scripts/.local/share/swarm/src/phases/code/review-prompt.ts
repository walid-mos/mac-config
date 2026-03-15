// === Review Prompt Builder (Spec 4 — FR-6) ===

import type { TestResult } from '../phase-results.js'
import {
  buildFileReferenceInstructions,
  buildIterationAwarenessSection,
  buildReviewJsonOutputSection,
  buildTestResultSection,
} from './review-prompt-shared.js'

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

// === API ===

export function buildReviewPrompt(opts: ReviewPromptOpts): string {
  const sections: string[] = []

  // Role
  sections.push('# Role\n\nYou are a code review agent. Review the following code changes for bugs, quality issues, performance problems, integration conflicts, and adherence to best practices.')

  // File reference instructions (replaces inlined diff, spec, project context, decision log)
  sections.push(buildFileReferenceInstructions({
    ...opts,
    projectContextLine: 'Read `package.json` for dependencies. Check config files (tsconfig.json, vite.config.ts, astro.config.mjs, etc.) for build setup.',
  }))

  // Changed files list
  sections.push(`# Changed Files\n\n${opts.changedFiles.map(f => `- ${f}`).join('\n')}`)

  // Integration & build compatibility rules
  sections.push(buildIntegrationRules())

  // Test results
  sections.push(buildTestResultSection(opts.testResult))

  // Iteration awareness (appended at iteration >= 2)
  if (opts.iterationIndex >= 2) {
    sections.push(buildIterationAwarenessSection(opts.iterationIndex))
  }

  // DRY enforcement
  sections.push('# DRY Enforcement\n\nDRY violations with 3 or more repetitions of the same string/pattern are severity `important`, NOT `suggestion`. Repeated class strings, duplicated logic blocks, and copy-pasted constants that appear 3+ times MUST be flagged as `important` with category `dry-violation`. The code agent MUST fix them.')

  // Fix quality
  sections.push('# Fix Quality\n\nEvery `suggestedFix` MUST be actionable — include the target file, the specific change, and why.\nBAD:  "Fix the link." / "Add missing element."\nGOOD: Specific file + what to add/change + where in the file.')

  // Output format
  sections.push(buildReviewJsonOutputSection())

  return sections.join('\n\n')
}

// === Consistency Review Prompt Builder ===

import type { TestResult } from '../phase-results.js'
import type { ProjectContext } from '../../detect/tech-stack.js'

// === API ===

export function buildConsistencyPrompt(
  diff: string,
  changedFiles: string[],
  specItemContext: string,
  testResult: TestResult,
  projectContext?: ProjectContext,
  decisionLog: string = ''
): string {
  const sections: string[] = []

  // Role
  sections.push('# Role\n\nYou are a consistency review agent. Analyze cross-component coherence, visual consistency, and holistic integration of the following code changes. Your goal is to catch issues that individual code review and security review miss — problems that only become visible when looking at multiple components together.\n\n## CRITICAL: Be Exhaustive — No Whack-a-Mole\n\nWhen you find an inconsistency on ONE element, you MUST immediately check ALL elements of the same type across ALL files in the diff. Report ONE comprehensive finding per category of inconsistency, listing EVERY affected element.\n\nBAD: "Button X in HeroSection.astro lacks focus-visible styles" (without checking the 5 other buttons)\nGOOD: "Focus-visible styles are missing on: HeroSection.astro:12, HeroSection.astro:15, Header.astro:11, Footer.astro:7, Footer.astro:8, ContactForm.astro:76. Only ContactForm.astro:63 has them. Fix: add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` to ALL listed elements."\n\nDo NOT report one element per finding. Report one CATEGORY of inconsistency with ALL affected elements listed. If you find `rounded-md` vs `rounded-lg` inconsistency, check EVERY element with a border-radius in the diff and list them all in one finding.\n\nThis is NON-NEGOTIABLE. Partial findings that miss sibling elements are worse than no finding at all — they cause an endless loop of fix-one-discover-another across iterations.')

  // Project context (if available)
  if (projectContext) {
    const ctxLines: string[] = ['# Project Context']
    if (projectContext.dependencies.length > 0) {
      ctxLines.push(`\n**Dependencies:** ${projectContext.dependencies.join(', ')}`)
    }
    if (projectContext.devDependencies.length > 0) {
      ctxLines.push(`**Dev Dependencies:** ${projectContext.devDependencies.join(', ')}`)
    }
    if (projectContext.configHighlights.length > 0) {
      ctxLines.push('\n## Config Files\n')
      ctxLines.push(projectContext.configHighlights.join('\n\n'))
    }
    sections.push(ctxLines.join('\n'))
  }

  // Changed files list
  sections.push(`# Changed Files\n\n${changedFiles.map(f => `- ${f}`).join('\n')}`)

  // Consistency review focus areas
  sections.push(buildConsistencyRules())

  // Git diff
  sections.push(`# Git Diff\n\n\`\`\`diff\n${diff}\n\`\`\``)

  // Spec context
  sections.push(`# Spec Context\n\n${specItemContext}`)

  // Test results
  sections.push(`# Test Results\n\n- Total: ${testResult.totalTests}\n- Passing: ${testResult.passingTests}\n- Failing: ${testResult.failingTests}\n- Duration: ${testResult.durationMs}ms`)

  // Decision log from previous iterations
  if (decisionLog) {
    sections.push(decisionLog)
  }

  // DRY enforcement
  sections.push('# DRY Enforcement\n\nDRY violations with 3 or more repetitions of the same string/pattern are severity `important`, NOT `suggestion`. Repeated class strings, duplicated logic blocks, and copy-pasted constants that appear 3+ times MUST be flagged as `important` with category `dry-violation`. List ALL occurrences in a single finding.')

  // Fix quality
  sections.push('# Fix Quality\n\nEvery `suggestedFix` MUST be actionable — include the target file, the specific change, and why.\nBAD:  "Fix the colors." / "Make it consistent."\nGOOD: Specific file + what to change + where in the file.')

  // Output format
  sections.push('# Output Format\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.\n\nReturn a JSON object with this structure:\n\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code" | "spec-compliance",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ]\n}\n\nAll string values in JSON must use proper JSON escaping — newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.')

  return sections.join('\n\n')
}

// === Helpers ===

function buildConsistencyRules(): string {
  return [
    '# Consistency Review Focus Areas',
    '',
    'For EVERY category below: when you find an inconsistency on one element, scan ALL elements of that type across ALL files and list them ALL in a single finding.',
    '',
    '## Visual Coherence',
    '- Check that color schemes are consistent across ALL components (e.g., text color vs background color).',
    '- Verify typography scales are uniform — headings, body text, and labels should follow the same type system.',
    '- Ensure spacing (padding, margin, gap) follows a consistent scale across ALL components.',
    '- Flag visual conflicts: light text on light background, dark text on dark background, clashing color combinations.',
    '- Check ALL interactive elements (buttons, links, CTAs) have consistent hover styles, transition behavior, and focus-visible styles. List every element.',
    '- Check ALL border-radius values across similar elements. List every element with its current value.',
    '',
    '## Component API Consistency',
    '- Check that prop naming patterns are consistent across components (e.g., all use `onClick` vs some using `handleClick`).',
    '- Verify event handler naming conventions match across the codebase.',
    '- Flag inconsistent patterns for similar functionality (e.g., one component uses `className` another uses `class`).',
    '',
    '## Cross-File Duplication',
    '- Identify the same styles, constants, or logic repeated across multiple changed files.',
    '- Flag shared values (colors, sizes, breakpoints) that are hardcoded in multiple places instead of using a shared constant or CSS variable.',
    '- DRY violations with 3+ repetitions: severity MUST be `important`, not `suggestion`.',
    '',
    '## Layout Integration',
    '- Verify components work together correctly in their layout context.',
    '- Check that hero sections, headers, and overlapping components have proper color contrast.',
    '- Verify z-index stacking makes sense across layered components.',
    '- Check responsive behavior is consistent across related components.',
    '',
    '## Accessibility Consistency',
    '- Check ALL interactive elements have keyboard focus indicators. List every element that has them and every element that doesn\'t.',
    '- Check heading hierarchy across ALL pages — h1 → h2 → h3 with no gaps.',
    '- Check ARIA attributes are applied consistently (if one error span has aria-live, ALL error spans must).',
    '',
  ].join('\n')
}

// === Security Review Prompt Builder (Spec 4 — FR-6) ===

import type { TestResult } from '../phase-results.js'

// === Types ===

export interface SecurityPromptOpts {
  changedFiles: string[]
  specPath: string
  testResult: TestResult
  decisionLogPath?: string
  iterationIndex: number
}

// === Helpers ===

function buildSecurityIntegrationRules(): string {
  const rules: string[] = [
    '# Supply Chain & Integration Security',
    '',
    '## External Resource Loading',
    '- For CDN-loaded scripts/styles: recommend Subresource Integrity (SRI) hashes if not present.',
    '- Flag `eval()`, `Function()`, or dynamic script injection from external sources.',
    '- Flag `http://` (non-HTTPS) URLs for any resource loading.',
    '- Do NOT flag CDN usage as inherently wrong — assess the actual risk based on context.',
    '- When external resources are loaded in a project with a dev server or bundler, verify the framework/build config supports them at runtime (CORS, CSP, proxy). If it doesn\'t, the fix is a CONFIG change — recommend the specific config modification for the detected framework.',
    '',
    '## Dependency Security',
    '- Flag wildcard or `latest` version specifiers in package.json.',
    '- Check for known vulnerable patterns in dependencies visible in the diff.',
    '',
    '## Secrets & Configuration',
    '- Flag secrets/tokens hardcoded in source files (should be env vars).',
    '- Flag permissive CORS configurations (`Access-Control-Allow-Origin: *`).',
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

function buildFileReferenceInstructions(opts: SecurityPromptOpts): string {
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
    'Read `package.json` for dependencies (attack surface). Check config files (tsconfig.json, vite.config.ts, astro.config.mjs, etc.) for security misconfigurations.',
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

export function buildSecurityPrompt(opts: SecurityPromptOpts): string {
  const sections: string[] = []

  // Role
  sections.push('# Role\n\nYou are a security review agent. Analyze the following code changes with focus on OWASP Top 10 vulnerabilities, injection risks, authentication/authorization issues, XSS, and other security concerns.\n\n## CRITICAL: Be Exhaustive on First Pass\n\nYou MUST find ALL security issues in a SINGLE pass. Do NOT drip-feed findings across iterations. Scan the ENTIRE diff and ALL config files for EVERY possible security concern NOW — headers, CSP directives, CSRF, XSS, injection, secrets, CORS, auth, transport security, framing, MIME sniffing, ALL of it. If you miss something on this pass and it appears in a later iteration, that is a failure.\n\n## Severity Rules\n\n- `critical`: Exploitable vulnerabilities — SQL injection, XSS with a working vector, hardcoded secrets in source, auth bypass, command injection. Real bugs that an attacker can exploit TODAY.\n- `important`: Real threat vectors with clear attack surface — missing CSP, missing CSRF protection on authenticated endpoints, permissive CORS on sensitive routes, missing input validation at system boundaries. Issues that create exploitable conditions even if no exploit exists yet.\n- `suggestion`: Defense-in-depth hardening — adding HSTS, tightening CSP directives further, removing unsafe-inline when not strictly needed, adding frame-ancestors when X-Frame-Options already covers it, theoretical future risks. These are good security hygiene but NOT blocking.\n\nDo NOT escalate defense-in-depth items to `important`. If the threat requires a chain of hypothetical future changes to become exploitable, it is a `suggestion`. Only flag real, present-day threat vectors as `important` or higher.')

  // File reference instructions (replaces inlined diff, spec, project context, decision log)
  sections.push(buildFileReferenceInstructions(opts))

  // Changed files list
  sections.push(`# Changed Files\n\n${opts.changedFiles.map(f => `- ${f}`).join('\n')}`)

  // Supply chain & integration security rules
  sections.push(buildSecurityIntegrationRules())

  // Test results
  sections.push(`# Test Results\n\n- Total: ${opts.testResult.totalTests}\n- Passing: ${opts.testResult.passingTests}\n- Failing: ${opts.testResult.failingTests}\n- Duration: ${opts.testResult.durationMs}ms`)

  // Iteration awareness (appended at iteration >= 2)
  if (opts.iterationIndex >= 2) {
    sections.push(buildIterationAwareness(opts.iterationIndex))
  }

  // Fix quality
  sections.push('# Fix Quality\n\nEvery `suggestedFix` MUST be actionable — a code agent must be able to implement it without further research.\n\nA good fix includes: (1) which file to modify, (2) the specific code or config change, (3) any commands to run if needed.\n\nBAD:  "Fix the security issue." / "Add headers." / "Improve configuration."\nGOOD: Specific file path + exact change + reason.\n\nIf you see a security issue but aren\'t sure of the exact fix for this specific framework/toolchain, say what needs to change and WHERE to investigate — don\'t just name the problem.')

  // Output format
  sections.push('# Output Format\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.\n\nReturn a JSON object with this structure:\n\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code" | "spec-compliance",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ]\n}\n\nAll string values in JSON must use proper JSON escaping — newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.')

  return sections.join('\n\n')
}

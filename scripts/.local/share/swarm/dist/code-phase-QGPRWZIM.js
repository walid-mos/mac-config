import {
  parseStructuredOutput
} from "./chunk-ELEMRGRH.js";
import {
  commitSpecItem,
  getChangedFiles,
  openDraftPr
} from "./chunk-4LLHLY2U.js";

// src/phases/code/iteration-logger.ts
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}
function attemptDir(sessionDir, waveIndex, attempt) {
  return join(sessionDir, `wave-${waveIndex}`, `attempt-${attempt}`);
}
function buildSummaryMarkdown(summary) {
  const lines = [
    `# Iteration Summary`,
    "",
    `- **Wave:** ${summary.waveIndex}`,
    `- **Attempt:** ${summary.attempt}`,
    `- **Status:** ${summary.status}`
  ];
  if (summary.reason) {
    lines.push(`- **Reason:** ${summary.reason}`);
  }
  if (summary.criticalCount !== void 0) {
    lines.push(`- **Critical findings:** ${summary.criticalCount}`);
  }
  if (summary.testResult) {
    lines.push("");
    lines.push("## Test Results");
    lines.push(`- Total: ${summary.testResult.totalTests}`);
    lines.push(`- Passing: ${summary.testResult.passingTests}`);
    lines.push(`- Failing: ${summary.testResult.failingTests}`);
    lines.push(`- Duration: ${summary.testResult.durationMs}ms`);
  }
  if (summary.buildResult) {
    lines.push("");
    lines.push("## Build Results");
    lines.push(`- Success: ${summary.buildResult.success}`);
    lines.push(`- Duration: ${summary.buildResult.durationMs}ms`);
  }
  lines.push("");
  return lines.join("\n");
}
function createIterationLogger(projectDir, sessionId) {
  const sessionDir = join(projectDir, ".swarm", "sessions", sessionId);
  ensureDir(sessionDir);
  return {
    sessionDir,
    logAgentPrompt(waveIndex, attempt, taskId, prompt) {
      const dir = attemptDir(sessionDir, waveIndex, attempt);
      ensureDir(dir);
      writeFileSync(join(dir, `agent-${taskId}-prompt.md`), prompt, "utf-8");
    },
    logAgentResult(waveIndex, attempt, taskId, result) {
      const dir = attemptDir(sessionDir, waveIndex, attempt);
      ensureDir(dir);
      writeFileSync(join(dir, `agent-${taskId}.md`), result, "utf-8");
    },
    logReview(waveIndex, attempt, review) {
      const dir = attemptDir(sessionDir, waveIndex, attempt);
      ensureDir(dir);
      writeFileSync(join(dir, "merged-review.json"), JSON.stringify(review, null, 2), "utf-8");
    },
    logTestResult(waveIndex, attempt, testResult) {
      const dir = attemptDir(sessionDir, waveIndex, attempt);
      ensureDir(dir);
      writeFileSync(join(dir, "test-result.json"), JSON.stringify(testResult, null, 2), "utf-8");
    },
    logBuildResult(waveIndex, attempt, buildResult) {
      const dir = attemptDir(sessionDir, waveIndex, attempt);
      ensureDir(dir);
      writeFileSync(join(dir, "build-result.json"), JSON.stringify(buildResult, null, 2), "utf-8");
    },
    logIterationSummary(waveIndex, attempt, summary) {
      const dir = attemptDir(sessionDir, waveIndex, attempt);
      ensureDir(dir);
      writeFileSync(join(dir, "summary.md"), buildSummaryMarkdown(summary), "utf-8");
    }
  };
}

// src/phases/code/dag-executor.ts
import { randomUUID } from "crypto";

// src/phases/plan/task-scheduler.ts
function buildDependencyGraph(tasks) {
  const taskMap = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }
  const inDegree = /* @__PURE__ */ new Map();
  const dependents = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    inDegree.set(task.id, 0);
    dependents.set(task.id, []);
  }
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskMap.has(dep)) continue;
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
      dependents.get(dep).push(task.id);
    }
  }
  return { inDegree, dependents, taskMap };
}

// src/phases/code/review-merge.ts
import { spawn } from "child_process";

// src/phases/code/review-prompt.ts
function buildIntegrationRules(projectContext) {
  const rules = [
    "# Integration & Build Compatibility Review",
    "",
    "## External Resources",
    "- If the project uses a bundler, check whether external CDN resources actually work with the build pipeline. Some CDN scripts are fine (analytics, fonts), others conflict with bundling.",
    "- If a CDN dependency has an equivalent npm package AND the project uses a bundler, suggest installing via the package manager as an IMPROVEMENT \u2014 not a hard block.",
    "- Never flag external resources that the spec explicitly requires.",
    "",
    "## Dependency Integrity",
    "- Flag imports/requires that reference packages not listed in package.json.",
    "- Flag dead dependencies (in package.json but never imported).",
    "- Check that framework-specific integrations use the correct adapter (e.g., `@astrojs/tailwind` for Astro).",
    "",
    "## Build Tool Compatibility",
    "- Check that code patterns are compatible with the detected build tool.",
    "- Flag CommonJS `require()` in ESM-only projects.",
    "- Flag hardcoded `localhost` URLs that should use environment variables.",
    "",
    "## Spec Compliance",
    "",
    "Read the spec context carefully. For EACH requirement described in the spec, verify the implementation satisfies it:",
    '- If the spec says "link to X" \u2014 verify the link exists AND its target exists',
    '- If the spec says "section with title Y" \u2014 verify the section and title are present',
    "- If the spec requires external resources \u2014 verify they work with the project's build/dev setup (check framework configs)",
    "- If the spec describes accessibility requirements \u2014 verify landmarks, ARIA attributes, keyboard navigation",
    "",
    "Flag any gap between spec and implementation as category `spec-compliance`.",
    ""
  ];
  return rules.join("\n");
}
function buildIterationAwareness(iterationIndex) {
  return [
    "# Iteration Awareness",
    "",
    `This is review iteration ${iterationIndex}. Previous iterations already identified and addressed multiple findings`,
    "(see Decision Log above).",
    "",
    "Rules for late iterations:",
    "- Severity is INTRINSIC to the finding. A suggestion on iteration 1 does NOT become important on",
    "  iteration 5 just because it persists. The severity reflects the IMPACT, not how many times you've",
    "  seen the codebase.",
    "- Do NOT re-raise findings from a different angle if the Decision Log shows they were already addressed.",
    '  "Missing null check" addressed in iteration 2 should not reappear as "potential undefined access" in',
    "  iteration 5 \u2014 that's the same issue rephrased.",
    "- Do NOT flag files under `.swarm/` \u2014 those are session artifacts, not project code.",
    "- If you have zero genuinely new findings, return an empty findings array. That is the CORRECT outcome \u2014",
    "  it means the code has converged.",
    ""
  ].join("\n");
}
function buildReviewPrompt(diff, specItemContext, testResult, projectContext, decisionLog = "", iterationIndex = 0) {
  const sections = [];
  sections.push("# Role\n\nYou are a code review agent. Review the following code changes for bugs, quality issues, performance problems, integration conflicts, and adherence to best practices.");
  if (projectContext) {
    const ctxLines = ["# Project Context"];
    if (projectContext.dependencies.length > 0) {
      ctxLines.push(`
**Dependencies:** ${projectContext.dependencies.join(", ")}`);
    }
    if (projectContext.devDependencies.length > 0) {
      ctxLines.push(`**Dev Dependencies:** ${projectContext.devDependencies.join(", ")}`);
    }
    if (projectContext.configHighlights.length > 0) {
      ctxLines.push("\n## Config Files\n");
      ctxLines.push(projectContext.configHighlights.join("\n\n"));
    }
    sections.push(ctxLines.join("\n"));
  }
  sections.push(buildIntegrationRules(projectContext));
  sections.push(`# Git Diff

\`\`\`diff
${diff}
\`\`\``);
  sections.push(`# Spec Context

${specItemContext}`);
  sections.push(`# Test Results

- Total: ${testResult.totalTests}
- Passing: ${testResult.passingTests}
- Failing: ${testResult.failingTests}
- Duration: ${testResult.durationMs}ms`);
  if (decisionLog) {
    sections.push(decisionLog);
  }
  if (iterationIndex >= 2) {
    sections.push(buildIterationAwareness(iterationIndex));
  }
  sections.push("# DRY Enforcement\n\nDRY violations with 3 or more repetitions of the same string/pattern are severity `important`, NOT `suggestion`. Repeated class strings, duplicated logic blocks, and copy-pasted constants that appear 3+ times MUST be flagged as `important` with category `dry-violation`. The code agent MUST fix them.");
  sections.push('# Fix Quality\n\nEvery `suggestedFix` MUST be actionable \u2014 include the target file, the specific change, and why.\nBAD:  "Fix the link." / "Add missing element."\nGOOD: Specific file + what to add/change + where in the file.');
  sections.push('# Output Format\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.\n\nReturn a JSON object with this structure:\n\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code" | "spec-compliance",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ]\n}\n\nAll string values in JSON must use proper JSON escaping \u2014 newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.');
  return sections.join("\n\n");
}

// src/phases/code/security-prompt.ts
function buildSecurityIntegrationRules(projectContext) {
  const rules = [
    "# Supply Chain & Integration Security",
    "",
    "## External Resource Loading",
    "- For CDN-loaded scripts/styles: recommend Subresource Integrity (SRI) hashes if not present.",
    "- Flag `eval()`, `Function()`, or dynamic script injection from external sources.",
    "- Flag `http://` (non-HTTPS) URLs for any resource loading.",
    "- Do NOT flag CDN usage as inherently wrong \u2014 assess the actual risk based on context.",
    "- When external resources are loaded in a project with a dev server or bundler, verify the framework/build config supports them at runtime (CORS, CSP, proxy). If it doesn't, the fix is a CONFIG change \u2014 recommend the specific config modification for the detected framework.",
    "",
    "## Dependency Security",
    "- Flag wildcard or `latest` version specifiers in package.json.",
    "- Check for known vulnerable patterns in dependencies visible in the diff.",
    "",
    "## Secrets & Configuration",
    "- Flag secrets/tokens hardcoded in source files (should be env vars).",
    "- Flag permissive CORS configurations (`Access-Control-Allow-Origin: *`).",
    ""
  ];
  return rules.join("\n");
}
function buildIterationAwareness2(iterationIndex) {
  return [
    "# Iteration Awareness",
    "",
    `This is review iteration ${iterationIndex}. Previous iterations already identified and addressed multiple findings`,
    "(see Decision Log above).",
    "",
    "Rules for late iterations:",
    "- Severity is INTRINSIC to the finding. A suggestion on iteration 1 does NOT become important on",
    "  iteration 5 just because it persists. The severity reflects the IMPACT, not how many times you've",
    "  seen the codebase.",
    "- Do NOT re-raise findings from a different angle if the Decision Log shows they were already addressed.",
    '  "Missing null check" addressed in iteration 2 should not reappear as "potential undefined access" in',
    "  iteration 5 \u2014 that's the same issue rephrased.",
    "- Do NOT flag files under `.swarm/` \u2014 those are session artifacts, not project code.",
    "- If you have zero genuinely new findings, return an empty findings array. That is the CORRECT outcome \u2014",
    "  it means the code has converged.",
    ""
  ].join("\n");
}
function buildSecurityPrompt(diff, specItemContext, testResult, projectContext, decisionLog = "", iterationIndex = 0) {
  const sections = [];
  sections.push("# Role\n\nYou are a security review agent. Analyze the following code changes with focus on OWASP Top 10 vulnerabilities, injection risks, authentication/authorization issues, XSS, and other security concerns.\n\n## CRITICAL: Be Exhaustive on First Pass\n\nYou MUST find ALL security issues in a SINGLE pass. Do NOT drip-feed findings across iterations. Scan the ENTIRE diff and ALL config files for EVERY possible security concern NOW \u2014 headers, CSP directives, CSRF, XSS, injection, secrets, CORS, auth, transport security, framing, MIME sniffing, ALL of it. If you miss something on this pass and it appears in a later iteration, that is a failure.\n\n## Severity Rules\n\n- `critical`: Exploitable vulnerabilities \u2014 SQL injection, XSS with a working vector, hardcoded secrets in source, auth bypass, command injection. Real bugs that an attacker can exploit TODAY.\n- `important`: Real threat vectors with clear attack surface \u2014 missing CSP, missing CSRF protection on authenticated endpoints, permissive CORS on sensitive routes, missing input validation at system boundaries. Issues that create exploitable conditions even if no exploit exists yet.\n- `suggestion`: Defense-in-depth hardening \u2014 adding HSTS, tightening CSP directives further, removing unsafe-inline when not strictly needed, adding frame-ancestors when X-Frame-Options already covers it, theoretical future risks. These are good security hygiene but NOT blocking.\n\nDo NOT escalate defense-in-depth items to `important`. If the threat requires a chain of hypothetical future changes to become exploitable, it is a `suggestion`. Only flag real, present-day threat vectors as `important` or higher.");
  if (projectContext) {
    const ctxLines = ["# Project Context \u2014 Security Surface"];
    if (projectContext.dependencies.length > 0) {
      ctxLines.push(`
**Dependencies (attack surface):** ${projectContext.dependencies.join(", ")}`);
    }
    if (projectContext.devDependencies.length > 0) {
      ctxLines.push(`**Dev Dependencies:** ${projectContext.devDependencies.join(", ")}`);
    }
    if (projectContext.configHighlights.length > 0) {
      ctxLines.push("\n## Config Files (check for security misconfigurations)\n");
      ctxLines.push(projectContext.configHighlights.join("\n\n"));
    }
    sections.push(ctxLines.join("\n"));
  }
  sections.push(buildSecurityIntegrationRules(projectContext));
  sections.push(`# Git Diff

\`\`\`diff
${diff}
\`\`\``);
  sections.push(`# Spec Context

${specItemContext}`);
  sections.push(`# Test Results

- Total: ${testResult.totalTests}
- Passing: ${testResult.passingTests}
- Failing: ${testResult.failingTests}
- Duration: ${testResult.durationMs}ms`);
  if (decisionLog) {
    sections.push(decisionLog);
  }
  if (iterationIndex >= 2) {
    sections.push(buildIterationAwareness2(iterationIndex));
  }
  sections.push('# Fix Quality\n\nEvery `suggestedFix` MUST be actionable \u2014 a code agent must be able to implement it without further research.\n\nA good fix includes: (1) which file to modify, (2) the specific code or config change, (3) any commands to run if needed.\n\nBAD:  "Fix the security issue." / "Add headers." / "Improve configuration."\nGOOD: Specific file path + exact change + reason.\n\nIf you see a security issue but aren\'t sure of the exact fix for this specific framework/toolchain, say what needs to change and WHERE to investigate \u2014 don\'t just name the problem.');
  sections.push('# Output Format\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.\n\nReturn a JSON object with this structure:\n\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code" | "spec-compliance",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ]\n}\n\nAll string values in JSON must use proper JSON escaping \u2014 newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.');
  return sections.join("\n\n");
}

// src/phases/code/consistency-prompt.ts
function buildIterationAwareness3(iterationIndex) {
  return [
    "# Iteration Awareness",
    "",
    `This is review iteration ${iterationIndex}. Previous iterations already identified and addressed multiple findings`,
    "(see Decision Log above).",
    "",
    "Rules for late iterations:",
    "- Severity is INTRINSIC to the finding. A suggestion on iteration 1 does NOT become important on",
    "  iteration 5 just because it persists. The severity reflects the IMPACT, not how many times you've",
    "  seen the codebase.",
    "- Do NOT re-raise findings from a different angle if the Decision Log shows they were already addressed.",
    '  "Missing null check" addressed in iteration 2 should not reappear as "potential undefined access" in',
    "  iteration 5 \u2014 that's the same issue rephrased.",
    "- Do NOT flag files under `.swarm/` \u2014 those are session artifacts, not project code.",
    "- If you have zero genuinely new findings, return an empty findings array. That is the CORRECT outcome \u2014",
    "  it means the code has converged.",
    ""
  ].join("\n");
}
function buildConsistencyPrompt(diff, changedFiles, specItemContext, testResult, projectContext, decisionLog = "", iterationIndex = 0) {
  const sections = [];
  sections.push('# Role\n\nYou are a consistency review agent. Analyze cross-component coherence, visual consistency, and holistic integration of the following code changes. Your goal is to catch issues that individual code review and security review miss \u2014 problems that only become visible when looking at multiple components together.\n\n## CRITICAL: Be Exhaustive \u2014 No Whack-a-Mole\n\nWhen you find an inconsistency on ONE element, you MUST immediately check ALL elements of the same type across ALL files in the diff. Report ONE comprehensive finding per category of inconsistency, listing EVERY affected element.\n\nBAD: "Button X in HeroSection.astro lacks focus-visible styles" (without checking the 5 other buttons)\nGOOD: "Focus-visible styles are missing on: HeroSection.astro:12, HeroSection.astro:15, Header.astro:11, Footer.astro:7, Footer.astro:8, ContactForm.astro:76. Only ContactForm.astro:63 has them. Fix: add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` to ALL listed elements."\n\nDo NOT report one element per finding. Report one CATEGORY of inconsistency with ALL affected elements listed. If you find `rounded-md` vs `rounded-lg` inconsistency, check EVERY element with a border-radius in the diff and list them all in one finding.\n\nThis is NON-NEGOTIABLE. Partial findings that miss sibling elements are worse than no finding at all \u2014 they cause an endless loop of fix-one-discover-another across iterations.');
  if (projectContext) {
    const ctxLines = ["# Project Context"];
    if (projectContext.dependencies.length > 0) {
      ctxLines.push(`
**Dependencies:** ${projectContext.dependencies.join(", ")}`);
    }
    if (projectContext.devDependencies.length > 0) {
      ctxLines.push(`**Dev Dependencies:** ${projectContext.devDependencies.join(", ")}`);
    }
    if (projectContext.configHighlights.length > 0) {
      ctxLines.push("\n## Config Files\n");
      ctxLines.push(projectContext.configHighlights.join("\n\n"));
    }
    sections.push(ctxLines.join("\n"));
  }
  sections.push(`# Changed Files

${changedFiles.map((f) => `- ${f}`).join("\n")}`);
  sections.push(buildConsistencyRules());
  sections.push(`# Git Diff

\`\`\`diff
${diff}
\`\`\``);
  sections.push(`# Spec Context

${specItemContext}`);
  sections.push(`# Test Results

- Total: ${testResult.totalTests}
- Passing: ${testResult.passingTests}
- Failing: ${testResult.failingTests}
- Duration: ${testResult.durationMs}ms`);
  if (decisionLog) {
    sections.push(decisionLog);
  }
  if (iterationIndex >= 2) {
    sections.push(buildIterationAwareness3(iterationIndex));
  }
  sections.push("# DRY Enforcement\n\nDRY violations with 3 or more repetitions of the same string/pattern are severity `important`, NOT `suggestion`. Repeated class strings, duplicated logic blocks, and copy-pasted constants that appear 3+ times MUST be flagged as `important` with category `dry-violation`. List ALL occurrences in a single finding.");
  sections.push('# Fix Quality\n\nEvery `suggestedFix` MUST be actionable \u2014 include the target file, the specific change, and why.\nBAD:  "Fix the colors." / "Make it consistent."\nGOOD: Specific file + what to change + where in the file.');
  sections.push('# Output Format\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.\n\nReturn a JSON object with this structure:\n\n{\n  "findings": [\n    {\n      "file": "string",\n      "line": number,\n      "severity": "critical" | "important" | "suggestion",\n      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code" | "spec-compliance",\n      "description": "string",\n      "suggestedFix": "string"\n    }\n  ]\n}\n\nAll string values in JSON must use proper JSON escaping \u2014 newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.');
  return sections.join("\n\n");
}
function buildConsistencyRules() {
  return [
    "# Consistency Review Focus Areas",
    "",
    "For EVERY category below: when you find an inconsistency on one element, scan ALL elements of that type across ALL files and list them ALL in a single finding.",
    "",
    "## Visual Coherence",
    "- Check that color schemes are consistent across ALL components (e.g., text color vs background color).",
    "- Verify typography scales are uniform \u2014 headings, body text, and labels should follow the same type system.",
    "- Ensure spacing (padding, margin, gap) follows a consistent scale across ALL components.",
    "- Flag visual conflicts: light text on light background, dark text on dark background, clashing color combinations.",
    "- Check ALL interactive elements (buttons, links, CTAs) have consistent hover styles, transition behavior, and focus-visible styles. List every element.",
    "- Check ALL border-radius values across similar elements. List every element with its current value.",
    "",
    "## Component API Consistency",
    "- Check that prop naming patterns are consistent across components (e.g., all use `onClick` vs some using `handleClick`).",
    "- Verify event handler naming conventions match across the codebase.",
    "- Flag inconsistent patterns for similar functionality (e.g., one component uses `className` another uses `class`).",
    "",
    "## Cross-File Duplication",
    "- Identify the same styles, constants, or logic repeated across multiple changed files.",
    "- Flag shared values (colors, sizes, breakpoints) that are hardcoded in multiple places instead of using a shared constant or CSS variable.",
    "- DRY violations with 3+ repetitions: severity MUST be `important`, not `suggestion`.",
    "",
    "## Layout Integration",
    "- Verify components work together correctly in their layout context.",
    "- Check that hero sections, headers, and overlapping components have proper color contrast.",
    "- Verify z-index stacking makes sense across layered components.",
    "- Check responsive behavior is consistent across related components.",
    "",
    "## Accessibility Consistency",
    "- Check ALL interactive elements have keyboard focus indicators. List every element that has them and every element that doesn't.",
    "- Check heading hierarchy across ALL pages \u2014 h1 \u2192 h2 \u2192 h3 with no gaps.",
    "- Check ARIA attributes are applied consistently (if one error span has aria-live, ALL error spans must).",
    ""
  ].join("\n");
}

// src/phases/code/merge-prompt.ts
function buildMergePrompt(findingsArrays, iterationIndex = 0, decisionLog = "", findingTrajectory = "") {
  const sections = [];
  sections.push("# Role\n\nYou are a review merger agent. Consolidate and deduplicate findings from the code review, security review, and consistency review into a single merged review.");
  const labels = ["Code Review", "Security Review", "Consistency Review"];
  for (let i = 0; i < findingsArrays.length; i++) {
    const label = labels[i] ?? `Review ${i + 1}`;
    const findings = findingsArrays[i] ?? [];
    sections.push(`# ${label} Findings

${JSON.stringify(findings, null, 2)}`);
  }
  sections.push("# Deduplication Instructions\n\n- Identify duplicate findings by matching file + line + category\n- When findings overlap, keep the most severe version\n- Preserve all unique findings from all three reviews\n- Count criticalCount, importantCount, and suggestionCount accurately");
  sections.push('# Finding Enhancement\n\nImprove vague findings during merge:\n- If both reviews flagged the same issue with different detail levels, keep the MORE detailed version\n- If a `suggestedFix` doesn\'t mention a file path or specific change, enhance it using context from both reviews\n- NEVER output a finding whose `suggestedFix` is just "fix the issue" or similarly vague \u2014 always include the target file and what to change');
  if (decisionLog) {
    sections.push(decisionLog);
  }
  if (iterationIndex > 0) {
    const trajectoryBlock = findingTrajectory ? `
Finding trajectory from previous waves:
${findingTrajectory}
` : "";
    sections.push([
      "# Convergence Assessment",
      "",
      "After merging findings, assess whether another code iteration would be productive.",
      "",
      'You MUST output a `convergenceRecommendation` field: "continue" or "converged".',
      trajectoryBlock,
      "Decision rules:",
      '- "continue": remaining critical/important findings describe NEW, actionable issues not previously',
      "  addressed. The code agent can make meaningful progress.",
      '- "converged": remaining findings are (a) variations of previously-addressed issues, (b) theoretical',
      "  edge cases unlikely in practice, (c) stylistic preferences, or (d) only suggestions. Another",
      "  iteration would produce diminishing returns.",
      '- If the finding trajectory shows a plateau (same count for 2+ waves), recommend "converged" \u2014 the',
      "  system is oscillating, not improving.",
      '- If all remaining blocking findings are marked [RECURRING] in the decision log, recommend "converged".',
      '- When in doubt, ask: "Would a senior engineer block this PR for these remaining findings?" If no \u2192',
      '  "converged".'
    ].join("\n"));
  }
  const convergenceField = iterationIndex > 0 ? ',\n  "convergenceRecommendation": "continue" | "converged"' : "";
  sections.push(`# Output Format

IMPORTANT: Output ONLY raw JSON. No markdown fences, no narrative text, no commentary before or after the JSON.

Return a JSON object with this structure:

{
  "findings": [
    {
      "file": "string",
      "line": number,
      "severity": "critical" | "important" | "suggestion",
      "category": "bug" | "security" | "quality" | "performance" | "dry-violation" | "dead-code",
      "description": "string",
      "suggestedFix": "string"
    }
  ],
  "criticalCount": number,
  "importantCount": number,
  "suggestionCount": number${convergenceField}
}

All string values in JSON must use proper JSON escaping \u2014 newlines as \\n, quotes as \\", backslashes as \\\\. Do NOT put raw newlines inside JSON string values.`);
  return sections.join("\n\n");
}

// src/detect/tech-stack.ts
import { existsSync, readFileSync } from "fs";
import { join as join2 } from "path";
var CONFIG_HIGHLIGHT_FILES = [
  "vite.config.ts",
  "vite.config.js",
  "astro.config.mjs",
  "astro.config.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "tsconfig.json"
];
var MAX_CONFIG_PREVIEW_BYTES = 2048;
async function readProjectContext(projectDir) {
  const packageJsonPath = join2(projectDir, "package.json");
  let dependencies = [];
  let devDependencies = [];
  if (existsSync(packageJsonPath)) {
    try {
      const raw = readFileSync(packageJsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      dependencies = Object.keys(parsed.dependencies ?? {});
      devDependencies = Object.keys(parsed.devDependencies ?? {});
    } catch (err) {
      process.stderr.write(`WARNING: Failed to read package.json in readProjectContext: ${err.message}
`);
    }
  }
  const configHighlights = [];
  for (const configFile of CONFIG_HIGHLIGHT_FILES) {
    const configPath = join2(projectDir, configFile);
    if (!existsSync(configPath)) continue;
    try {
      const raw = readFileSync(configPath, "utf-8");
      const preview = raw.length > MAX_CONFIG_PREVIEW_BYTES ? raw.slice(0, MAX_CONFIG_PREVIEW_BYTES) + "\n...(truncated)" : raw;
      configHighlights.push(`### ${configFile}
\`\`\`
${preview}
\`\`\``);
    } catch (err) {
      process.stderr.write(`WARNING: Failed to read config file ${configFile}: ${err.message}
`);
    }
  }
  return {
    dependencies,
    devDependencies,
    configHighlights
  };
}

// src/phases/code/review-merge.ts
var MAX_SPEC_CONTEXT_BYTES = 4096;
var MAX_RETRIES = 2;
var SENSITIVE_PATTERNS = [/^\.env($|\.)/, /\.pem$/, /\.key$/];
function isRetryableErrorCode(code) {
  return code === "timeout" || code === "crash" || code === "empty_output" || code === "invalid_json";
}
function isImmediateFailErrorCode(code) {
  return code === "aborted" || code === "spawn_error";
}
function filterSensitiveFiles(files) {
  return files.filter((f) => {
    const basename = f.split("/").pop() ?? f;
    return !SENSITIVE_PATTERNS.some((p) => p.test(basename));
  });
}
function truncateSpec(spec) {
  if (Buffer.byteLength(spec, "utf-8") <= MAX_SPEC_CONTEXT_BYTES) return spec;
  return Buffer.from(spec, "utf-8").subarray(0, MAX_SPEC_CONTEXT_BYTES).toString("utf-8");
}
function spawnGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`git ${args[0]} failed (exit ${code}): ${stderr || stdout}`));
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`git spawn error: ${err.message}`));
    });
  });
}
function parseReviewFindings(output) {
  const cleaned = parseStructuredOutput(output);
  if (!cleaned.ok) {
    process.stderr.write(`WARNING: Failed to parse review findings: no valid JSON found
`);
    process.stderr.write(`Raw output (first 200 chars): ${output.slice(0, 200)}
`);
    return [];
  }
  try {
    const parsed = JSON.parse(cleaned.output);
    return parsed.findings ?? [];
  } catch (err) {
    process.stderr.write(`WARNING: Failed to parse review findings JSON: ${err.message}
`);
    process.stderr.write(`Raw output (first 200 chars): ${output.slice(0, 200)}
`);
    return [];
  }
}
function parseMergedReview(output) {
  const cleaned = parseStructuredOutput(output);
  if (!cleaned.ok) {
    process.stderr.write(`WARNING: Failed to parse merged review: no valid JSON found
`);
    process.stderr.write(`Raw output (first 200 chars): ${output.slice(0, 200)}
`);
    return { findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0 };
  }
  try {
    const parsed = JSON.parse(cleaned.output);
    return {
      findings: parsed.findings ?? [],
      criticalCount: parsed.criticalCount ?? 0,
      importantCount: parsed.importantCount ?? 0,
      suggestionCount: parsed.suggestionCount ?? 0,
      convergenceRecommendation: parsed.convergenceRecommendation === "converged" ? "converged" : "continue"
    };
  } catch (err) {
    process.stderr.write(`WARNING: Failed to parse merged review JSON: ${err.message}
`);
    process.stderr.write(`Raw output (first 200 chars): ${output.slice(0, 200)}
`);
    return { findings: [], criticalCount: 0, importantCount: 0, suggestionCount: 0 };
  }
}
async function invokeWithRetry(ctx, registry, role, prompt, signal) {
  const { driver, model, agent } = registry.getDriver(role);
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw new Error(`${role} review aborted`);
    }
    const result = await driver.invoke({
      prompt,
      role,
      agent,
      model,
      projectDir: ctx.projectDir,
      signal
    });
    if (result.success) return result;
    if (isImmediateFailErrorCode(result.errorCode)) {
      throw new Error(`${role} review failed: ${result.errorCode}: ${result.error}`);
    }
    if (isRetryableErrorCode(result.errorCode) && attempt < MAX_RETRIES) {
      ctx.emitter.emit({
        type: "agent:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { role, reason: `${result.errorCode}: ${result.error}` }
      });
      continue;
    }
    throw new Error(`${role} review failed after ${attempt + 1} attempts: ${result.errorCode}`);
  }
  throw new Error(`${role} review failed: all retries exhausted`);
}
function buildFindingTrajectory(iterations) {
  return iterations.map((iter) => {
    const review = "review" in iter.outcome ? iter.outcome.review : void 0;
    if (!review) return `Wave ${iter.iteration}: (no review)`;
    return `Wave ${iter.iteration}: ${review.criticalCount} critical, ${review.importantCount} important, ${review.suggestionCount} suggestion${review.suggestionCount !== 1 ? "s" : ""}`;
  }).join("\n");
}
async function runReviewPhase(ctx, registry, changedFiles, specItemContext, testResult, signal, decisionLog = "", iterationIndex = 0, iterations = []) {
  if (signal?.aborted) {
    throw new Error("Review phase aborted");
  }
  const safeFiles = filterSensitiveFiles(changedFiles);
  const truncatedSpec = truncateSpec(specItemContext);
  let diff = "";
  if (safeFiles.length > 0) {
    try {
      await spawnGit(["add", "-N", "--", ...safeFiles], ctx.projectDir);
    } catch (err) {
      process.stderr.write(`WARNING: git add -N failed: ${err.message}
`);
    }
    try {
      const result = await spawnGit(["diff", "HEAD", "--", ...safeFiles], ctx.projectDir);
      diff = result.stdout;
    } catch (err) {
      process.stderr.write(`WARNING: git diff failed, review will run on empty diff: ${err.message}
`);
      diff = "(diff unavailable)";
    }
  }
  let projectContext;
  try {
    projectContext = await readProjectContext(ctx.projectDir);
  } catch (err) {
    process.stderr.write(`WARNING: readProjectContext failed: ${err.message}
`);
  }
  const reviewPrompt = buildReviewPrompt(diff, truncatedSpec, testResult, projectContext, decisionLog, iterationIndex);
  const securityPromptText = buildSecurityPrompt(diff, truncatedSpec, testResult, projectContext, decisionLog, iterationIndex);
  const consistencyPromptText = buildConsistencyPrompt(diff, safeFiles, truncatedSpec, testResult, projectContext, decisionLog, iterationIndex);
  const [codeReviewResult, securityReviewResult, consistencyResult] = await Promise.all([
    invokeWithRetry(ctx, registry, "review", reviewPrompt, signal),
    invokeWithRetry(ctx, registry, "security", securityPromptText, signal),
    invokeWithRetry(ctx, registry, "consistency", consistencyPromptText, signal)
  ]);
  const codeOutput = codeReviewResult.success ? codeReviewResult.output : "";
  const secOutput = securityReviewResult.success ? securityReviewResult.output : "";
  const consistencyOutput = consistencyResult.success ? consistencyResult.output : "";
  const codeFindings = parseReviewFindings(codeOutput);
  const securityFindings = parseReviewFindings(secOutput);
  const consistencyFindings = parseReviewFindings(consistencyOutput);
  const trajectory = buildFindingTrajectory(iterations);
  const mergePrompt = buildMergePrompt([codeFindings, securityFindings, consistencyFindings], iterationIndex, decisionLog, trajectory);
  const mergeResult = await invokeWithRetry(ctx, registry, "merge", mergePrompt, signal);
  const mergeOutput = mergeResult.success ? mergeResult.output : "";
  let merged = parseMergedReview(mergeOutput);
  const { restored, warnings } = verifyMergeIntegrity(codeFindings, securityFindings, consistencyFindings, merged.findings);
  if (restored.length > 0) {
    merged = {
      findings: [...merged.findings, ...restored],
      criticalCount: merged.criticalCount + restored.filter((f) => f.severity === "critical").length,
      importantCount: merged.importantCount + restored.filter((f) => f.severity === "important").length,
      suggestionCount: merged.suggestionCount + restored.filter((f) => f.severity === "suggestion").length
    };
    for (const warning of warnings) {
      process.stderr.write(`${warning}
`);
    }
  }
  ctx.emitter.emit({
    type: "review:findings",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: {
      critical: merged.criticalCount,
      important: merged.importantCount,
      suggestion: merged.suggestionCount
    }
  });
  return merged;
}
function verifyMergeIntegrity(codeReviewFindings, securityFindings, consistencyFindings, mergedFindings) {
  const allCritical = [
    ...codeReviewFindings.filter((f) => f.severity === "critical"),
    ...securityFindings.filter((f) => f.severity === "critical"),
    ...consistencyFindings.filter((f) => f.severity === "critical")
  ];
  const restored = [];
  const warnings = [];
  for (const critical of allCritical) {
    const found = mergedFindings.some(
      (m) => m.file === critical.file && m.line === critical.line && m.category === critical.category
    );
    if (!found) {
      restored.push(critical);
      warnings.push(
        `Critical finding dropped by merge agent: ${critical.file}:${critical.line ?? "?"} [${critical.category}] \u2014 restored`
      );
    }
  }
  return { restored, warnings };
}

// src/phases/code/code-agent-prompt.ts
var MAX_FINDINGS_BYTES = 32768;
function buildCodeAgentPrompt(task, testFiles, techStack, previousFindings, decisionLog = "") {
  const sections = [];
  sections.push("# Role\n\nYou are a code implementation agent. Write production-quality code that passes all tests and follows coding conventions.");
  sections.push(`# Task

- **ID**: ${task.id}
- **Title**: ${task.title}
- **Description**: ${task.description}`);
  if (task.testHints.length > 0) {
    sections.push(`# Test Hints

${task.testHints.map((h) => `- ${h}`).join("\n")}`);
  }
  if (testFiles.length > 0) {
    sections.push(`# Test Files

${testFiles.map((f) => `- ${f}`).join("\n")}`);
  }
  sections.push(`# Tech Stack

- Languages: ${techStack.languages.join(", ")}
- Frameworks: ${techStack.frameworks.join(", ")}
- Test runner: ${techStack.testRunner ?? "none"}
- Package manager: ${techStack.packageManager}
- Build tool: ${techStack.buildTool ?? "none"}
- Test command: ${techStack.testCommand}${techStack.buildCommand ? `
- Build command: ${techStack.buildCommand}` : ""}${techStack.typecheckCommand ? `
- Typecheck command: ${techStack.typecheckCommand}` : ""}${techStack.lintCommand ? `
- Lint command: ${techStack.lintCommand}` : ""}`);
  if (previousFindings && previousFindings.length > 0) {
    let findingsText = previousFindings.map(
      (f) => `- [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ""} (${f.category}): ${f.description}${f.suggestedFix ? ` \u2014 Fix: ${f.suggestedFix}` : ""}`
    ).join("\n");
    if (Buffer.byteLength(findingsText, "utf-8") > MAX_FINDINGS_BYTES) {
      findingsText = Buffer.from(findingsText, "utf-8").subarray(0, MAX_FINDINGS_BYTES).toString("utf-8");
      findingsText += "\n\n[Findings truncated \u2014 32KB limit reached]";
    }
    sections.push(`# Previous Review Findings

Address these findings from the previous iteration:

${findingsText}`);
  }
  if (decisionLog) {
    sections.push(decisionLog);
  }
  sections.push(`# Constraints

- Focus on implementing the task described above. Other tasks are handled by other agents \u2014 avoid implementing functionality that belongs to a different task.
- Follow existing code patterns and conventions
- Write minimal, focused code
- Handle errors properly
- Type everything \u2014 no \`any\` types
- Guard clauses (early returns) over nested ifs
- Implement all changes by writing files directly \u2014 do not just describe changes
- When a dependency is needed: if the project has a bundler, install it via the package manager (e.g., \`pnpm add <pkg>\`) and import it. If no bundler, CDN is acceptable \u2014 use HTTPS and add Subresource Integrity (SRI) hashes.
- NEVER delete functionality that the spec requires. If a review finding conflicts with the spec, find a way to satisfy BOTH \u2014 do not simply remove the feature.`);
  const executionLines = ["# Execution", "", "You MUST run tests and build after making changes \u2014 do NOT just write code and stop."];
  executionLines.push("", "## Test Execution", `- Run: ${techStack.testCommand}`, "- If tests fail, read the output, fix your code, and re-run until ALL tests pass", "- Do NOT report back with failing tests \u2014 iterate until green");
  if (techStack.buildCommand) {
    executionLines.push("", "## Build Execution", `- Run: ${techStack.buildCommand}`, "- If build fails, read errors, fix, and re-run until it succeeds", "- A passing test suite with a broken build is NOT acceptable");
  }
  if (techStack.typecheckCommand) {
    executionLines.push("", "## Type Check Execution", `- Run: ${techStack.typecheckCommand}`, "- If type errors appear, fix your code and re-run until clean", "- A passing test suite with type errors is NOT acceptable");
  }
  if (techStack.lintCommand) {
    executionLines.push("", "## Lint Execution", `- Run: ${techStack.lintCommand}`, "- If lint errors appear, fix your code and re-run until clean", "- Do NOT disable lint rules \u2014 fix the underlying issue");
  }
  executionLines.push("", "## Output", "When done, output this JSON block:", "```json", '{ "filesChanged": ["path/to/file.ts"], "testResult": { "totalTests": 0, "passingTests": 0, "failingTests": 0 }, "buildResult": { "success": true, "error": null }, "summary": "Brief description of changes" }', "```");
  sections.push(executionLines.join("\n"));
  sections.push(`# Handling Review Findings

When addressing review findings from previous iterations:
1. Read the \`suggestedFix\` \u2014 if it names a file and a specific change, implement it.
2. If the fix is vague, use the \`file\` and \`description\` fields to determine what to change. Apply standard best practices for the \`category\`.
3. If a finding conflicts with spec requirements:
   - NEVER remove spec-required functionality to satisfy a finding
   - Instead, fix the ENVIRONMENT (config, settings, framework setup) to make the spec-required feature work correctly
4. Findings prefixed \`[RECURRING]\` failed to be fixed in previous iterations. Try a DIFFERENT approach than what was attempted before.`);
  return sections.join("\n\n");
}
var SEVERITY_ORDER = {
  critical: 0,
  important: 1,
  suggestion: 2
};
function buildFindingFixPrompt(findings, decisionLog = "") {
  const sections = [];
  sections.push("# Fix Required");
  const grouped = /* @__PURE__ */ new Map();
  for (const f of findings) {
    const list = grouped.get(f.severity) ?? [];
    list.push(f);
    grouped.set(f.severity, list);
  }
  const sortedSeverities = [...grouped.keys()].sort(
    (a, b) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b]
  );
  for (const severity of sortedSeverities) {
    const items = grouped.get(severity);
    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    const lines = items.map((f) => {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      const fix = f.suggestedFix ? `
  Suggested fix: ${f.suggestedFix}` : "";
      return `- ${loc} [${f.category}] \u2014 ${f.description}${fix}`;
    });
    sections.push(`## ${label}
${lines.join("\n")}`);
  }
  sections.push("Fix ONLY these issues. Run tests after fixing.");
  if (decisionLog) {
    sections.push(decisionLog);
  }
  sections.push('## Output\n```json\n{ "filesChanged": [...], "testResult": {...}, "buildResult": {...}, "summary": "..." }\n```');
  return sections.join("\n\n");
}

// src/phases/tdd/test-prompt.ts
function buildTestPrompt(plannerOutput, tasks, techStack, testConventions) {
  const lines = [];
  lines.push("# Role");
  lines.push("");
  lines.push("You are a TDD test engineer. Your single purpose is to write **failing tests** (RED phase) that define expected behavior for each task. Tests must be syntactically valid, compile successfully, and **fail for the right reason** \u2014 they fail because the implementation does not exist yet, not because the test is broken.");
  lines.push("");
  lines.push("# Tech Stack");
  lines.push("");
  lines.push(`- **Test Runner**: ${techStack.testRunner ?? "not detected"}`);
  lines.push(`- **Languages**: ${techStack.languages.join(", ") || "none"}`);
  lines.push(`- **Frameworks**: ${techStack.frameworks.join(", ") || "none"}`);
  lines.push(`- **Test Command**: ${techStack.testCommand}`);
  lines.push("");
  lines.push("# Planner Output");
  lines.push("");
  lines.push(plannerOutput.trim());
  lines.push("");
  lines.push("# Tasks to Test");
  lines.push("");
  for (const task of tasks) {
    lines.push(`## ${task.id}: ${task.title}`);
    lines.push(`- **Tag**: ${task.tag}`);
    lines.push(`- **Description**: ${task.description}`);
    lines.push(`- **Test hints**: ${task.testHints.join(", ")}`);
    lines.push("");
  }
  lines.push("# Testing Conventions");
  lines.push("");
  for (const convention of testConventions) {
    lines.push(`- ${convention}`);
  }
  lines.push("");
  lines.push("# What to Test");
  lines.push("");
  lines.push("For each task, test the following behaviors:");
  lines.push("");
  lines.push("## Happy Path");
  lines.push("- Expected inputs produce expected outputs");
  lines.push("- Core business logic behaves correctly");
  lines.push("- Return types and shapes are correct");
  lines.push("");
  lines.push("## Edge Cases");
  lines.push("- Empty inputs (null, undefined, empty string, empty array, empty object)");
  lines.push("- Boundary values (min, max, zero, negative, overflow)");
  lines.push("- Single-element vs multi-element collections");
  lines.push("- Unicode / special characters in string inputs");
  lines.push("");
  lines.push("## Error Handling");
  lines.push("- Invalid inputs throw or return appropriate errors");
  lines.push("- Missing required parameters are rejected");
  lines.push("- Malformed data is handled gracefully");
  lines.push("- Async operations that fail are caught and propagated");
  lines.push("");
  lines.push("## Security");
  lines.push("- Input validation rejects injection attempts (SQL, XSS, command injection)");
  lines.push("- Authentication/authorization checks are enforced");
  lines.push("- Sensitive data is not leaked in error messages or logs");
  lines.push("- Path traversal attempts are blocked");
  lines.push("- Rate limiting / resource limits are enforced where applicable");
  lines.push("");
  lines.push("## Functional Behavior");
  lines.push("- If the spec describes user-facing features (navigation, forms, interactions), tests must verify the BEHAVIOR works \u2014 not just that markup exists");
  lines.push('- For links: verify both the link AND its target exist (e.g., an anchor `href="#X"` is useless without a matching `id="X"`)');
  lines.push("- For components that compose into pages: verify the composition works by reading source files and asserting on imports, slots, and props \u2014 NEVER by running a build");
  lines.push("- For external resources: verify URLs are well-formed and use HTTPS");
  lines.push("");
  lines.push("IMPORTANT: Tests must verify BEHAVIOR, not just structure.");
  lines.push("- BAD:  `expect(content).toContain('href=\"#features\"')`  \u2014 only checks string presence");
  lines.push('- GOOD: also verify `id="features"` exists on the target element');
  lines.push("- BAD:  `expect(existsSync('Component.astro')).toBe(true)` \u2014 only checks file exists");
  lines.push("- GOOD: read the file and verify it contains the spec-required content/structure");
  lines.push("");
  lines.push("# Test Writing Guidelines");
  lines.push("");
  lines.push("## Naming Convention \u2014 MANDATORY");
  lines.push("");
  lines.push("`describe` blocks and `it` names MUST use functional, user-facing language. NEVER use technical file names, component names, or task IDs.");
  lines.push("- BAD:  `describe('BaseLayout.astro')`, `it('creates Header component')`");
  lines.push("- GOOD: `describe('Base page layout')`, `it('includes site metadata and viewport settings')`");
  lines.push("- BAD:  `describe('TASK-1')`, `it('renders FeaturesSection')`");
  lines.push("- GOOD: `describe('Features showcase')`, `it('displays feature cards with icons and descriptions')`");
  lines.push("");
  lines.push("## DO");
  lines.push("- Test public API / exported functions only");
  lines.push('- Test behavior: "given X input, expect Y output"');
  lines.push('- Test error conditions: "given invalid input, expect specific error"');
  lines.push("- Use descriptive `describe` blocks that read like documentation");
  lines.push("- Use factory functions or builders for test data");
  lines.push("- Mock external dependencies (DB, HTTP, file system) at module boundaries");
  lines.push("- Keep each test focused on one behavior");
  lines.push("- Use clear test names: `it('returns empty array when no items match filter')`");
  lines.push("");
  lines.push("## DON'T");
  lines.push("- Don't test private/internal functions directly");
  lines.push("- Don't use snapshot tests");
  lines.push("- Don't test framework internals");
  lines.push("- Don't write tests that depend on execution order");
  lines.push("- Don't duplicate assertions across tests");
  lines.push("- Don't mock the module under test");
  lines.push("- Don't write overly specific assertions that break on irrelevant changes");
  lines.push("- NEVER run build commands (pnpm build, npm run build, etc.) inside tests \u2014 builds are slow, couple tests to the entire project, and belong in CI, not in the test suite. To verify build output, read source files and assert on their content instead.");
  lines.push("");
  lines.push("## Mock Strategy");
  lines.push("- **External services**: Always mock (DB, HTTP, file system, third-party APIs)");
  lines.push("- **Internal modules**: Mock only at architectural boundaries (e.g., mock the repository when testing the service)");
  lines.push("- **Utilities**: Don't mock pure utility functions \u2014 use them directly");
  lines.push("");
  lines.push("# Constraints");
  lines.push("");
  lines.push("1. All tests MUST fail in the RED phase \u2014 they fail because implementation doesn't exist, not because the test is broken.");
  lines.push("2. Tests MUST be syntactically valid \u2014 they must compile and be parseable by the test runner.");
  lines.push("3. Write one test file per task. Follow project directory conventions.");
  lines.push("4. Use describe/it/expect patterns appropriate for the test runner.");
  lines.push("5. Test file paths must be relative to the project root.");
  lines.push("6. Minimum 3 tests per task: happy path + edge case + error case.");
  lines.push("7. NEVER write implementation code \u2014 tests only.");
  lines.push("8. Tests MUST verify that the implementation WORKS, not just that files exist or strings are present. If the spec describes linked elements (nav \u2192 sections, form \u2192 endpoint, button \u2192 action), test BOTH sides of the link.");
  lines.push('9. NEVER write a test that passes when implementation is broken. If a test checks `href="#X"` exists, it MUST also check that an element with `id="X"` exists \u2014 otherwise the test gives false confidence.');
  lines.push("10. NEVER write tests that pass before implementation \u2014 if a test passes, it tests nothing useful.");
  lines.push("");
  lines.push("# Execution");
  lines.push("");
  lines.push("After writing tests, run them to verify they fail (red phase):");
  lines.push(`- Command: ${techStack.testCommand}`);
  lines.push("- Tests MUST fail (red) since no implementation exists yet");
  lines.push("- If tests pass, they are wrong \u2014 tests that pass without implementation are useless");
  lines.push("");
  lines.push("# Output");
  lines.push("");
  lines.push("After running tests, output a JSON block:");
  lines.push("```json");
  lines.push('{ "testFiles": ["path/to/test.ts"], "testResult": { "totalTests": 0, "passingTests": 0, "failingTests": 0 }, "isRed": true }');
  lines.push("```");
  return lines.join("\n");
}

// src/phases/tdd/tdd-phase.ts
var MAX_RETRIES2 = 2;
function isRetryableErrorCode2(code) {
  return code === "timeout" || code === "crash" || code === "empty_output" || code === "invalid_json";
}
function isImmediateFailErrorCode2(code) {
  return code === "aborted" || code === "spawn_error";
}
function extractTddAgentOutput(output) {
  const parsed = parseStructuredOutput(output);
  if (!parsed.ok) return null;
  try {
    const json = JSON.parse(parsed.output);
    if (!json.testFiles || !Array.isArray(json.testFiles)) return null;
    return {
      testFiles: json.testFiles,
      testResult: {
        totalTests: json.testResult?.totalTests ?? 0,
        passingTests: json.testResult?.passingTests ?? 0,
        failingTests: json.testResult?.failingTests ?? 0,
        durationMs: json.testResult?.durationMs ?? 0
      },
      isRed: json.isRed ?? false
    };
  } catch {
    return null;
  }
}
var DEFAULT_AGENT_OUTPUT = {
  testFiles: ["tests/feature.test.ts"],
  testResult: { totalTests: 0, passingTests: 0, failingTests: 0, durationMs: 0 },
  isRed: false
};
async function runTddForTasks(ctx, registry, plannerOutput, tasks, techStack, signal) {
  if (signal?.aborted) {
    throw new Error("TDD aborted");
  }
  const testConventions = [
    "tests/**/*.test.ts",
    `Use ${techStack.testRunner ?? "default"} test runner`
  ];
  const prompt = buildTestPrompt(plannerOutput, tasks, techStack, testConventions);
  const { driver, model, agent } = registry.getDriver("test");
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES2; attempt++) {
    if (signal?.aborted) {
      throw new Error("TDD aborted");
    }
    const agentResult = await driver.invoke({
      prompt: currentPrompt,
      role: "test",
      agent,
      model,
      projectDir: ctx.projectDir
    });
    if (!agentResult.success) {
      if (isImmediateFailErrorCode2(agentResult.errorCode)) {
        ctx.emitter.emit({
          type: "phase:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: ctx.sessionId,
          data: { phase: "tdd", reason: `${agentResult.errorCode}: ${agentResult.error}` }
        });
        throw new Error(`TDD failed: ${agentResult.errorCode}: ${agentResult.error}`);
      }
      if (isRetryableErrorCode2(agentResult.errorCode) && attempt < MAX_RETRIES2) {
        const reason = agentResult.errorCode === "timeout" && agentResult.stderr ? `${agentResult.errorCode}: ${agentResult.error} \u2014 stderr: ${agentResult.stderr.slice(0, 300)}` : `${agentResult.errorCode}: ${agentResult.error}`;
        ctx.emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: ctx.sessionId,
          data: { role: "test", reason }
        });
        continue;
      }
      ctx.emitter.emit({
        type: "phase:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: "tdd", reason: `All retries exhausted: ${agentResult.errorCode}` }
      });
      throw new Error(`TDD failed after ${attempt + 1} attempts: ${agentResult.errorCode}`);
    }
    const agentOutput = extractTddAgentOutput(agentResult.output) ?? DEFAULT_AGENT_OUTPUT;
    if (agentOutput.testResult.totalTests === 0) {
      if (attempt < MAX_RETRIES2) {
        currentPrompt = `${prompt}

# Previous Attempt Failed \u2014 Zero Tests

Your previous attempt produced zero compilable tests. Please produce compilable, failing test files. Remember to run the tests and include the JSON output block.`;
        ctx.emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: ctx.sessionId,
          data: { role: "test", reason: "Zero tests produced" }
        });
        continue;
      }
      ctx.emitter.emit({
        type: "test:fail",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { totalTests: 0, failingTests: 0, reason: "Test agent produced zero tests" }
      });
      return { testFiles: agentOutput.testFiles, agentReport: agentOutput };
    }
    if (!agentOutput.isRed && attempt < MAX_RETRIES2) {
      currentPrompt = `${prompt}

# Previous Attempt Failed \u2014 Tests Not Red

Your tests passed without implementation. Tests that pass before implementation are useless. Rewrite tests that properly fail.`;
      ctx.emitter.emit({
        type: "agent:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { role: "test", reason: "Tests not red \u2014 passed without implementation" }
      });
      continue;
    }
    if (agentOutput.isRed) {
      ctx.emitter.emit({
        type: "test:red",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: {
          totalTests: agentOutput.testResult.totalTests,
          passingTests: agentOutput.testResult.passingTests,
          failingTests: agentOutput.testResult.failingTests
        }
      });
    } else {
      ctx.emitter.emit({
        type: "test:green",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: {
          totalTests: agentOutput.testResult.totalTests,
          passingTests: agentOutput.testResult.passingTests
        }
      });
    }
    return {
      testFiles: agentOutput.testFiles,
      agentReport: agentOutput
    };
  }
  ctx.emitter.emit({
    type: "phase:error",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: "tdd", reason: "Unknown error" }
  });
  throw new Error("TDD failed");
}

// src/phases/code/dag-executor.ts
var MAX_RETRIES3 = 2;
async function spawnFreshAgent(node, ctx, registry, techStack, testFiles, decisionLog, signal) {
  const { driver, model, agent } = registry.getDriver("code", node.task.tag);
  const prompt = buildCodeAgentPrompt(node.task, testFiles, techStack, void 0, decisionLog);
  for (let attempt = 0; attempt <= MAX_RETRIES3; attempt++) {
    if (signal?.aborted) throw new Error("DAG execution aborted");
    const result = await driver.invoke({
      prompt,
      role: "code",
      agent,
      model,
      projectDir: ctx.projectDir,
      signal,
      sessionId: node.handle.sessionId
    });
    if (result.success) {
      const output = extractCodeAgentOutput(result.output);
      if (output) {
        for (const f of output.filesChanged) {
          if (!node.handle.filesChanged.includes(f)) {
            node.handle.filesChanged.push(f);
          }
        }
      }
      return output;
    }
    if (isImmediateFailErrorCode3(result.errorCode)) {
      throw new Error(`Code agent failed: ${result.errorCode}: ${result.error}`);
    }
    if (isRetryableErrorCode3(result.errorCode) && attempt < MAX_RETRIES3) {
      ctx.emitter.emit({
        type: "agent:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { role: "code", reason: `${result.errorCode}: ${result.error}` }
      });
      continue;
    }
    throw new Error(`Code agent failed after ${attempt + 1} attempts: ${result.errorCode}`);
  }
  return null;
}
async function resumeAgentWithFindings(node, ctx, registry, techStack, testFiles, decisionLog, signal) {
  const { driver, model, agent } = registry.getDriver("code", node.task.tag);
  const findings = node.lastFindings ?? [];
  const prompt = buildFindingFixPrompt(findings, decisionLog);
  for (let attempt = 0; attempt <= MAX_RETRIES3; attempt++) {
    if (signal?.aborted) throw new Error("DAG execution aborted");
    const isFirstAttempt = attempt === 0;
    const result = await driver.invoke({
      prompt,
      role: "code",
      agent,
      model,
      projectDir: ctx.projectDir,
      signal,
      ...isFirstAttempt ? { resume: node.handle.sessionId } : {}
    });
    if (result.success) {
      const output = extractCodeAgentOutput(result.output);
      if (output) {
        for (const f of output.filesChanged) {
          if (!node.handle.filesChanged.includes(f)) {
            node.handle.filesChanged.push(f);
          }
        }
      }
      return output;
    }
    if (isFirstAttempt && isRetryableErrorCode3(result.errorCode)) {
      ctx.emitter.emit({
        type: "agent:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { role: "code", reason: `Resume failed (${result.errorCode}), falling back to fresh invocation` }
      });
      const fullPrompt = buildCodeAgentPrompt(node.task, testFiles, techStack, findings, decisionLog);
      const fallbackResult = await driver.invoke({
        prompt: fullPrompt,
        role: "code",
        agent,
        model,
        projectDir: ctx.projectDir,
        signal
      });
      if (fallbackResult.success) {
        const output = extractCodeAgentOutput(fallbackResult.output);
        if (output) {
          for (const f of output.filesChanged) {
            if (!node.handle.filesChanged.includes(f)) {
              node.handle.filesChanged.push(f);
            }
          }
        }
        return output;
      }
      if (isImmediateFailErrorCode3(fallbackResult.errorCode)) {
        throw new Error(`Code agent failed: ${fallbackResult.errorCode}: ${fallbackResult.error}`);
      }
      continue;
    }
    if (isImmediateFailErrorCode3(result.errorCode)) {
      throw new Error(`Code agent failed: ${result.errorCode}: ${result.error}`);
    }
    if (isRetryableErrorCode3(result.errorCode) && attempt < MAX_RETRIES3) {
      ctx.emitter.emit({
        type: "agent:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { role: "code", reason: `${result.errorCode}: ${result.error}` }
      });
      continue;
    }
    throw new Error(`Code agent failed after ${attempt + 1} attempts: ${result.errorCode}`);
  }
  return null;
}
async function executeDag(ctx, registry, tasks, techStack, specItemContext, plannerOutput, signal, logger, gitState) {
  if (tasks.length === 0) {
    return { taskCompletions: [], iterations: [] };
  }
  const { dependents, taskMap } = buildDependencyGraph(tasks);
  const nodes = /* @__PURE__ */ new Map();
  const remainingDeps = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    const validDeps = task.dependencies.filter((d) => taskMap.has(d));
    remainingDeps.set(task.id, validDeps.length);
    nodes.set(task.id, {
      taskId: task.id,
      task,
      status: "pending",
      handle: {
        taskId: task.id,
        sessionId: randomUUID(),
        task,
        filesChanged: [],
        status: "active"
      },
      attempts: 0,
      decisionLogEntries: [],
      seenSignatures: /* @__PURE__ */ new Set()
    });
  }
  const iterations = [];
  let lastOutcome;
  let waveIndex = 0;
  const accumulatedTestFiles = [];
  while (true) {
    if (signal?.aborted) throw new Error("DAG execution aborted");
    const ready = [];
    for (const node of nodes.values()) {
      if (node.status === "pending" && (remainingDeps.get(node.taskId) ?? 0) === 0) {
        ready.push(node);
      }
    }
    const fixable = [];
    for (const node of nodes.values()) {
      if (node.status === "converging" && node.lastFindings && node.lastFindings.length > 0) {
        fixable.push(node);
      }
    }
    if (ready.length === 0 && fixable.length === 0) break;
    const wave = [...ready, ...fixable];
    const waveHandles = wave.map((n) => n.handle);
    ctx.emitter.emit({
      type: "iteration:start",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: ctx.sessionId,
      data: {
        iteration: waveIndex,
        waveIndex,
        taskCount: wave.length,
        taskIds: wave.map((n) => n.taskId)
      }
    });
    const pendingInWave = wave.filter((n) => n.status === "pending");
    if (pendingInWave.length > 0) {
      try {
        const tddResult = await runTddForTasks(
          ctx,
          registry,
          plannerOutput,
          pendingInWave.map((n) => n.task),
          techStack,
          signal
        );
        for (const f of tddResult.testFiles) {
          if (!accumulatedTestFiles.includes(f)) {
            accumulatedTestFiles.push(f);
          }
        }
      } catch (err) {
        process.stderr.write(`Warning: TDD for wave ${waveIndex} failed: ${err.message}
`);
      }
    }
    let agentTestResult = DEFAULT_TEST_RESULT;
    const agentOutputs = await Promise.all(
      wave.map(async (node) => {
        const decisionLog = buildDecisionLogSection(node.decisionLogEntries);
        if (node.status === "pending") {
          node.status = "running";
          return spawnFreshAgent(node, ctx, registry, techStack, accumulatedTestFiles, decisionLog, signal);
        }
        return resumeAgentWithFindings(node, ctx, registry, techStack, accumulatedTestFiles, decisionLog, signal);
      })
    );
    for (const output of agentOutputs) {
      if (output?.testResult && output.testResult.totalTests > agentTestResult.totalTests) {
        agentTestResult = output.testResult;
      }
    }
    const allChangedFiles = await getChangedFiles(ctx.projectDir);
    const globalDecisionLog = buildDecisionLogSection(
      [...nodes.values()].flatMap((n) => n.decisionLogEntries)
    );
    const review = await runReviewPhase(
      ctx,
      registry,
      allChangedFiles,
      specItemContext,
      agentTestResult,
      signal,
      globalDecisionLog,
      waveIndex,
      iterations
    );
    logger.logReview(waveIndex, 0, review);
    if (agentTestResult.totalTests > 0) {
      logger.logTestResult(waveIndex, 0, agentTestResult);
    }
    const reviewFailing = review.criticalCount + review.importantCount > 0;
    const success = !reviewFailing;
    const outcome = success ? { status: "green", testResult: agentTestResult, review } : { status: "needs-iteration", testResult: agentTestResult, review, reason: "review-findings" };
    iterations.push({ iteration: iterations.length, outcome, changedFiles: allChangedFiles });
    lastOutcome = outcome;
    ctx.emitter.emit({
      type: "iteration:end",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: ctx.sessionId,
      data: { iteration: waveIndex, success, reason: success ? void 0 : "review-findings" }
    });
    let blockingFindings = review.findings.filter(
      (f) => f.severity === "critical" || f.severity === "important"
    );
    if (review.convergenceRecommendation === "converged") {
      const demoted = blockingFindings.filter((f) => f.severity === "important");
      if (demoted.length > 0) {
        process.stderr.write(
          `[convergence] Merge agent recommends converged \u2014 demoting ${demoted.length} important finding(s)
`
        );
      }
      blockingFindings = blockingFindings.filter((f) => f.severity === "critical");
    }
    const attribution = attributeFindingsToAgents(blockingFindings, waveHandles);
    const uncommittedFiles = new Set(allChangedFiles);
    const greenNodes = [];
    for (const node of wave) {
      node.attempts++;
      const taskFindings = attribution.get(node.taskId) ?? [];
      const deduplicated = deduplicateFindings(taskFindings, node.seenSignatures);
      if (deduplicated.length === 0) {
        node.status = "green";
        node.handle.status = "green";
        greenNodes.push(node);
        for (const depId of dependents.get(node.taskId) ?? []) {
          remainingDeps.set(depId, (remainingDeps.get(depId) ?? 1) - 1);
        }
      } else {
        node.status = "converging";
        if (node.lastFindings && node.lastFindings.length > 0) {
          for (const f of node.lastFindings) {
            node.decisionLogEntries.push(buildDecisionEntry(node.attempts - 1, f));
          }
        }
        node.lastFindings = deduplicated;
      }
      logger.logIterationSummary(waveIndex, node.attempts - 1, {
        waveIndex,
        attempt: node.attempts - 1,
        status: node.status === "green" ? "green" : "needs-iteration",
        reason: node.status === "converging" ? "review-findings" : void 0,
        criticalCount: review.criticalCount,
        testResult: agentTestResult
      });
    }
    for (const node of greenNodes) {
      const taskFiles = node.handle.filesChanged.filter((f) => uncommittedFiles.has(f));
      if (taskFiles.length === 0) continue;
      try {
        const msg = `feat(swarm): ${node.task.title}`;
        const hash = await commitSpecItem(ctx.projectDir, taskFiles, msg);
        node.commitHash = hash;
        gitState.commits.push({ hash, message: msg, specItem: node.task.title, iteration: iterations.length - 1 });
        for (const f of taskFiles) uncommittedFiles.delete(f);
        ctx.emitter.emit({
          type: "commit",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: ctx.sessionId,
          data: { hash, message: msg, filesChanged: taskFiles.length }
        });
      } catch (err) {
        process.stderr.write(`Warning: commit failed for ${node.taskId}: ${err.message}
`);
      }
    }
    waveIndex++;
  }
  const taskCompletions = [];
  for (const node of nodes.values()) {
    taskCompletions.push({
      taskId: node.taskId,
      title: node.task.title,
      status: "green",
      attempts: node.attempts,
      commitHash: node.commitHash
    });
  }
  return { taskCompletions, iterations, lastOutcome };
}

// src/phases/code/code-phase.ts
function isRetryableErrorCode3(code) {
  return code === "timeout" || code === "crash" || code === "empty_output" || code === "invalid_json";
}
function isImmediateFailErrorCode3(code) {
  return code === "aborted" || code === "spawn_error";
}
function findingSignature(f) {
  return `${f.file}:${f.line ?? 0}:${f.category}`;
}
var FUZZY_LINE_RANGE = 5;
function matchesSeenFinding(finding, seenSignatures) {
  const exactSig = findingSignature(finding);
  if (seenSignatures.has(exactSig)) return true;
  const line = finding.line ?? 0;
  if (line === 0) return false;
  for (let offset = -FUZZY_LINE_RANGE; offset <= FUZZY_LINE_RANGE; offset++) {
    if (offset === 0) continue;
    const candidateLine = line + offset;
    if (candidateLine < 1) continue;
    const candidateSig = `${finding.file}:${candidateLine}:${finding.category}`;
    if (seenSignatures.has(candidateSig)) return true;
  }
  return false;
}
function deduplicateFindings(findings, seenSignatures) {
  const deduplicated = [];
  const currentSet = /* @__PURE__ */ new Set();
  for (const finding of findings) {
    const sig = findingSignature(finding);
    if (currentSet.has(sig)) continue;
    currentSet.add(sig);
    const isRecurring = matchesSeenFinding(finding, seenSignatures);
    seenSignatures.add(sig);
    deduplicated.push({
      ...finding,
      description: `${isRecurring ? "[RECURRING] " : "[NEW] "}${finding.description}`
    });
  }
  return deduplicated;
}
function extractCodeAgentOutput(output) {
  const parsed = parseStructuredOutput(output);
  if (!parsed.ok) return null;
  try {
    const json = JSON.parse(parsed.output);
    return {
      filesChanged: json.filesChanged ?? [],
      testResult: {
        totalTests: json.testResult?.totalTests ?? 0,
        passingTests: json.testResult?.passingTests ?? 0,
        failingTests: json.testResult?.failingTests ?? 0,
        durationMs: json.testResult?.durationMs ?? 0
      },
      buildResult: json.buildResult ?? null,
      summary: json.summary ?? ""
    };
  } catch {
    return null;
  }
}
var DEFAULT_TEST_RESULT = { totalTests: 0, passingTests: 0, failingTests: 0, durationMs: 0 };
function buildDecisionEntry(iteration, finding) {
  return `- **Iteration ${iteration}** | ${finding.file}${finding.line ? `:${finding.line}` : ""} | ${finding.severity} ${finding.category}: ${finding.description.replace(/^\[(NEW|RECURRING)\]\s*/, "")} \u2192 **Applied fix**: ${finding.suggestedFix ?? "N/A"}`;
}
function buildDecisionLogSection(entries) {
  if (entries.length === 0) return "";
  return [
    "# Previous Iteration Decisions",
    "",
    "The following findings were addressed in previous iterations. These decisions are **FINAL**.",
    "Do NOT re-open, reverse, or contradict them unless you have concrete evidence that the applied fix introduced a NEW bug or regression.",
    `Disagreeing with a design tradeoff (e.g., "novalidate should/shouldn't be used") is NOT a valid reason to re-open \u2014 the tradeoff was already evaluated and decided.`,
    "",
    ...entries,
    ""
  ].join("\n");
}
function attributeFindingsToAgents(findings, handles) {
  const attribution = /* @__PURE__ */ new Map();
  const unmatched = [];
  for (const finding of findings) {
    let matched = false;
    for (const handle of handles) {
      if (handle.status === "closed") continue;
      if (handle.filesChanged.some((file) => finding.file === file)) {
        const list = attribution.get(handle.taskId) ?? [];
        list.push(finding);
        attribution.set(handle.taskId, list);
        matched = true;
        break;
      }
    }
    if (!matched) {
      unmatched.push(finding);
    }
  }
  if (unmatched.length > 0) {
    for (const handle of handles) {
      if (handle.status === "closed") continue;
      const list = attribution.get(handle.taskId) ?? [];
      list.push(...unmatched);
      attribution.set(handle.taskId, list);
    }
  }
  return attribution;
}
async function runCodePhase(ctx, registry, plan, signal) {
  const startTime = Date.now();
  if (signal?.aborted) {
    ctx.emitter.emit({
      type: "phase:error",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: "code", reason: "Aborted" }
    });
    throw new Error("Code phase aborted");
  }
  ctx.emitter.emit({
    type: "phase:start",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: "code" }
  });
  if (ctx.dryRun) {
    const result2 = {
      waves: [],
      iterations: [],
      finalTestResult: DEFAULT_TEST_RESULT,
      gitState: { branch: "", commits: [] },
      changedFiles: [],
      success: true
    };
    ctx.emitter.emit({
      type: "phase:end",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: "code", durationMs: Date.now() - startTime }
    });
    return result2;
  }
  const gitState = { branch: ctx.worktreeBranch ?? `swarm/${ctx.sessionId}`, commits: [] };
  try {
    if (gitState.branch) {
      const { prNumber, prUrl } = await openDraftPr(gitState.branch, ctx.sessionId, ctx.projectDir);
      gitState.prNumber = prNumber;
      gitState.prUrl = prUrl;
    }
  } catch (err) {
    process.stderr.write(`Warning: failed to open draft PR: ${err.message}
`);
  }
  const logger = createIterationLogger(ctx.projectDir, ctx.sessionId);
  const specItemContext = plan.plannerOutput.slice(0, 4096);
  const dagResult = await executeDag(
    ctx,
    registry,
    plan.tasks,
    plan.techStack,
    specItemContext,
    plan.plannerOutput,
    signal,
    logger,
    gitState
  );
  const lastOutcome = dagResult.lastOutcome;
  const finalTestResult = lastOutcome?.testResult ?? DEFAULT_TEST_RESULT;
  const finalReview = lastOutcome && "review" in lastOutcome ? lastOutcome.review : void 0;
  const success = true;
  let finalChangedFiles = [];
  try {
    finalChangedFiles = await getChangedFiles(ctx.projectDir);
  } catch (err) {
    process.stderr.write(`Warning: failed to detect changed files: ${err.message}
`);
  }
  const result = {
    waves: [],
    iterations: dagResult.iterations,
    finalTestResult,
    finalReview,
    gitState,
    changedFiles: finalChangedFiles,
    success,
    taskCompletions: dagResult.taskCompletions
  };
  try {
    const loadResult = ctx.state.load();
    if (loadResult.found && "valid" in loadResult && loadResult.valid) {
      const state = loadResult.state;
      state.currentPhase = "code";
      state.completedPhases = [...state.completedPhases, "code"];
      state.phaseResults = { ...state.phaseResults, code: result };
      state.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      ctx.state.save(state);
    }
  } catch (err) {
    process.stderr.write(`Warning: state save failed: ${err.message}
`);
  }
  ctx.emitter.emit({
    type: "phase:end",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: "code", durationMs: Date.now() - startTime }
  });
  return result;
}
export {
  DEFAULT_TEST_RESULT,
  attributeFindingsToAgents,
  buildDecisionEntry,
  buildDecisionLogSection,
  deduplicateFindings,
  extractCodeAgentOutput,
  findingSignature,
  isImmediateFailErrorCode3 as isImmediateFailErrorCode,
  isRetryableErrorCode3 as isRetryableErrorCode,
  matchesSeenFinding,
  runCodePhase
};

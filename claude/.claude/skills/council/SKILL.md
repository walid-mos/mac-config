---
name: council
description: Spawn 5 expert review agents (sages) that collaboratively refine a plan or spec through multiple deliberation rounds until convergence. Plan in → refined plan out. Spec in → refined spec out.
user-invocable: true
argument-hint: <path-to-plan-or-spec>
allowed-tools: Task, Read, Glob, Grep, Write, Edit, AskUserQuestion, Bash
---

# Council Skill — Multi-Expert Deliberation Loop

You orchestrate a **council of 5 expert sages** that collaboratively review and refine a plan or spec through multiple deliberation rounds. Each sage brings a distinct expertise lens. Together, through iterative refinement, they produce a battle-hardened document.

**You do NOT review the document yourself.** You orchestrate the sages, synthesize their feedback, and manage the convergence loop.

---

## Core Philosophy

1. **Collective intelligence > individual review** — 5 focused experts catch more than 1 generalist
2. **Iterative convergence** — each round builds on the previous; sages see all prior feedback
3. **Format preservation** — plan in → plan out, spec in → spec out. The structure and format of the input document is preserved in the output
4. **Actionable feedback only** — every issue must have a concrete fix, not vague criticism
5. **Respect project context** — sages read the codebase, reference project skills, and apply project conventions

---

## Step 0 — Argument Parsing & Input Detection

### Resolve the input

The user invokes `/council <path-to-file>` or `/council` with no argument.

1. If an argument is provided, treat it as a file path. Read the file.
2. If no argument is provided, ask via AskUserQuestion: "Which file should the council review?" with an option to paste inline content.
3. If the file does not exist, report the error and stop.

### Classify the document

Read the file and classify it:

| Signal | Classification |
|--------|---------------|
| Contains `## Functional Requirements` with `FR-*` items | **spec** |
| Contains `## Implementation Phases` or `PLAN-*` items or `## Task List` | **plan** |
| Neither pattern matches | **generic** (treat as plan-like) |

Store the classification. The output MUST match the input format — a spec stays a spec, a plan stays a plan.

### Gather project context

Run in parallel:

1. **Tech stack detection**: read `package.json`, glob for framework configs (`astro.config.*`, `next.config.*`, `vite.config.*`, `tsconfig.json`, `tailwind.config.*`), detect languages/frameworks
2. **Relevant skills**: based on tech stack, identify which project skills apply (typescript, react, astro, tailwind, clean-code, docker, etc.)
3. **Known patterns**: read `docs/troubleshooting.md` if it exists, check memory files for project anti-patterns

Compile this into a `projectContext` block passed to every sage.

---

## The Five Sages

Each sage is a **Plan** subagent (`subagent_type: "Plan"`) — read-only, deep analysis.

### Sage 1: Architect

**Lens**: System design, modularity, dependency management, API design, scalability

- Are modules properly decomposed with clean boundaries?
- Are dependencies explicit, acyclic, and minimal?
- Does the architecture support the stated requirements without over-engineering?
- Are integration points well-defined?
- Is the data flow clear and efficient?

### Sage 2: Security

**Lens**: OWASP Top 10, input validation, auth/authz, data protection, secrets handling

- Are all user inputs validated at system boundaries?
- Are authentication and authorization flows complete?
- Are there injection vectors (SQL, XSS, command injection)?
- Are secrets, tokens, and sensitive data handled properly (no hardcoding, proper env vars)?
- Are error messages safe (no stack traces or internal details leaked)?

### Sage 3: Clean Code

**Lens**: DRY, SOLID, guard clauses, naming, complexity, readability

- Is there planned duplication that should be extracted?
- Are names clear, consistent, and following conventions?
- Are guard clauses specified (not nested conditionals)?
- Is complexity minimized — no premature abstractions, no over-engineering?
- Does the plan produce code that reads top-to-bottom without mental gymnastics?

### Sage 4: Reliability

**Lens**: Error handling, edge cases, testing strategy, failure modes, observability

- Are all error paths identified and handled (no swallowed errors)?
- Are edge cases documented and covered?
- Is the testing strategy complete and appropriate for each component?
- Are failure modes identified with recovery strategies?
- Is there observability planned (logging, monitoring, health checks)?

### Sage 5: Standards

**Lens**: Project conventions, skill compliance, naming rules, structure patterns

- Does the plan follow project naming conventions (PascalCase components, camelCase functions, kebab-case files)?
- Are relevant project skills respected (typescript standards, react patterns, etc.)?
- Does the file/directory structure follow established project patterns?
- Are anti-patterns from project memory/troubleshooting actively avoided?
- Is the plan consistent with how the existing codebase is structured?

---

## Deliberation Loop

### Constants

```
MIN_ROUNDS = 3       # Always run at least 3 rounds
MAX_ROUNDS = 5       # Hard stop after 5 rounds
CONVERGENCE_THRESHOLD = 8   # All sages must score >= 8/10
MAX_NEW_SUGGESTIONS = 3     # Suggestions below this count = converged
```

### Step 1 — Sage Review (Parallel)

Spawn ALL 5 sages **in a single message with 5 parallel Task calls**. Never spawn them sequentially.

**Sage prompt template** (customize `[SAGE_NAME]`, `[SAGE_NUMBER]`, `[LENS_DESCRIPTION]`, and `[FOCUS_QUESTIONS]` per sage):

```
You are the **[SAGE_NAME]** (Sage [SAGE_NUMBER]/5) on a council of experts reviewing a document.

## Your Expertise Lens
[LENS_DESCRIPTION]

## Focus Questions
[FOCUS_QUESTIONS]

## Document Under Review (Round {round}/{MAX_ROUNDS})
---
{currentDocument}
---

## Previous Round Context
{previousRoundFeedback OR "This is the first round. No prior feedback exists."}

## Project Context
- Tech stack: {techStack}
- Relevant skills: {relevantSkills}
- Known anti-patterns: {knownAntiPatterns}

## Instructions

Review the document STRICTLY through your expertise lens. Do not comment on areas outside your domain — the other 4 sages cover those.

If this is round 2+, focus on:
- Whether previous issues in YOUR area were properly addressed
- NEW issues revealed by changes from the previous round
- Do NOT repeat issues that were already fixed

Produce your review in this EXACT format:

### Score: X/10
How well the document performs on YOUR dimension. Be calibrated:
- 1-3: Fundamentally broken in your area
- 4-5: Major gaps that would cause problems
- 6-7: Adequate but with clear improvements needed
- 8-9: Strong, only minor refinements
- 10: Exemplary in your area, no changes needed

### Critical Issues
Issues that MUST be fixed — they would cause bugs, security holes, architectural problems, or convention violations if left as-is. Each item must include a concrete fix.

Format: `- **[ID]**: [description] → **Fix**: [specific change]`

If none: "None."

### Suggestions
Improvements that SHOULD be made — the document works without them but would be better with them. Each item must include the specific improvement.

Format: `- **[ID]**: [description] → **Improve**: [specific change]`

If none: "None."

### Strengths
Brief — what the document already does well in your area (2-3 bullet points max).

### Revised Sections
If you recommend changing specific sections, provide the EXACT revised text. Use this format:

**Section: `## [Section Name]`**
```
[exact revised content for that section]
```

Only include sections you want changed. If your feedback is captured in Critical Issues / Suggestions and doesn't need a full rewrite, skip this.
```

### Step 2 — Synthesis

After all 5 sages return, YOU (the orchestrator) synthesize:

1. **Collect scores**: record per-sage scores for the round table
2. **Merge critical issues**: deduplicate overlapping issues, keep all unique ones
3. **Merge suggestions**: deduplicate, keep unique ones
4. **Resolve conflicts**: if two sages disagree (e.g., Architect wants a new abstraction, Clean Code says it's over-engineering), prefer the sage whose expertise is most relevant to the specific issue. Note the resolution in the changelog.
5. **Apply all critical issue fixes** to the document
6. **Apply non-conflicting suggestions** to the document
7. **Apply revised sections** from sages, preferring the version from the most relevant sage when sections overlap
8. **Preserve format**: spec stays spec, plan stays plan — same sections, same structure

Produce:
- The **revised document** (full text, ready for the next round or final output)
- A **round changelog** (bulleted list: what changed, which sage drove it)

Write the revised document to the original file path using Edit/Write.

### Step 3 — Convergence Check

```
IF round < MIN_ROUNDS:
    → CONTINUE (always do at least 3 rounds)
ELSE IF round >= MAX_ROUNDS:
    → STOP (hard limit reached)
ELSE IF all sage scores >= CONVERGENCE_THRESHOLD
     AND critical issues count == 0
     AND new suggestions count <= MAX_NEW_SUGGESTIONS:
    → STOP (converged)
ELSE:
    → CONTINUE
```

If CONTINUE: go to Step 1 with the revised document.
If STOP: go to Step 4.

### Step 4 — Final Output

1. Ensure the final document is written to the original file path
2. Present the deliberation summary to the user:

```markdown
## Council Deliberation Complete

**Document**: `<file path>` (<format: spec|plan|generic>)
**Rounds**: <N>
**Outcome**: <Converged | Max rounds reached>

### Score Progression

| Sage | R1 | R2 | R3 | ... | Final |
|------|----|----|----|----|-------|
| Architect | X | X | X | ... | X |
| Security | X | X | X | ... | X |
| Clean Code | X | X | X | ... | X |
| Reliability | X | X | X | ... | X |
| Standards | X | X | X | ... | X |
| **Average** | **X** | **X** | **X** | ... | **X** |

### Key Improvements
- [Most impactful changes across all rounds, grouped by theme]

### Round Changelog
- **Round 1→2**: [summary of changes applied]
- **Round 2→3**: [summary of changes applied]
- ...

### Remaining Notes
[Any suggestions that were deliberately not applied, with rationale.
 Or "None — all feedback was incorporated."]
```

---

## Sage Prompt Assembly Reference

When constructing sage prompts, use this mapping:

| Sage | Name | Lens Description | Focus Questions |
|------|------|-----------------|-----------------|
| 1 | Architect | System design, modularity, dependency management, API design, scalability | Are modules decomposed with clean boundaries? Are dependencies explicit and acyclic? Does architecture support requirements without over-engineering? |
| 2 | Security | OWASP Top 10, input validation, auth/authz, data protection, secrets handling | Are inputs validated at boundaries? Are auth flows complete? Any injection vectors? Are secrets handled properly? |
| 3 | Clean Code | DRY, SOLID, guard clauses, naming conventions, complexity reduction | Is there duplication to extract? Are names clear and conventional? Are guard clauses used? Is complexity minimal? |
| 4 | Reliability | Error handling, edge cases, testing strategy, failure modes, observability | Are error paths handled? Are edge cases covered? Is testing strategy complete? Are failure modes identified? |
| 5 | Standards | Project conventions, skill compliance, naming rules, structure patterns | Does it follow naming conventions? Are project skills respected? Does structure follow project patterns? Are known anti-patterns avoided? |

---

## Anti-Patterns

1. **Never skip sages** — all 5 run every round, even if their area scored 10/10 (changes from other sages may introduce regressions in their area)
2. **Never spawn sages sequentially** — always 5 parallel Task calls in a single message
3. **Never modify the document format** — spec stays spec, plan stays plan, same sections
4. **Never add fluff** — sages produce actionable feedback with concrete fixes, not vague praise or generic advice
5. **Never stop before MIN_ROUNDS** — even if round 1 looks perfect, rounds 2-3 catch subtle interactions between sage changes
6. **Never exceed MAX_ROUNDS** — diminishing returns; note remaining issues in the summary instead
7. **Never let synthesis introduce new opinions** — synthesis ONLY applies sage feedback, it does not inject the orchestrator's own review
8. **Never ignore project context** — the Standards Sage exists specifically to enforce project conventions; skipping project context detection undermines the entire council
9. **Never repeat fixed issues** — round 2+ sages must focus on new issues and verification of fixes, not re-flagging resolved items

---

## Edge Cases

- **Tiny document (< 20 lines)**: still run the full loop — short documents often have the most critical gaps
- **Very large document (> 500 lines)**: warn the user that rounds will be thorough but slower; proceed normally
- **No project context** (no package.json, no configs): the Standards Sage focuses on general best practices instead of project-specific conventions
- **Document in non-English**: translate to English during review, produce output in English (per project rules)
- **User wants to review mid-loop**: if the user interrupts, present current state and ask whether to continue or stop early

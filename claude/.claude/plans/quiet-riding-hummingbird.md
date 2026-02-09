# Plan: Enforce Mandatory Review & Validation Gates in Swarm

## Context

The Lead Agent skipped Code Review, Security Review, and validation gates entirely during the `nextnode-standards` swarm run — despite the lead-agent.md having explicit "NEVER skip" rules (lines 535-537). The root cause is twofold:

1. **The swarm launcher (`SKILL.md`) added a shortcut in its prompt**: `"Since this is a config-only package with no runtime code, you can skip TDD/testing agents."` — This gave the Lead Agent implicit permission to skip everything.
2. **The Lead Agent's anti-patterns are buried in a 612-line document** — by the time the agent gets to the actual orchestration loop, context pressure makes it collapse everything into a single direct-implementation approach, ignoring its own Phase A → B → C → D protocol.

## Root Causes to Fix

| # | Problem | Location | Fix |
|---|---------|----------|-----|
| 1 | Swarm launcher prompt told agent to skip testing/review | `SKILL.md` Step 3 template | Remove any shortcut language from the CRITICAL INSTRUCTIONS block |
| 2 | Lead Agent's mandatory gates are text-only — no structural enforcement | `lead-agent.md` | Add a pre-completion checklist that MUST be satisfied before returning |
| 3 | Lead Agent has no validation of its OWN output before returning | `lead-agent.md` COMPLETION PROTOCOL | Add self-audit step that checks iteration history for missing phases |
| 4 | The swarm launcher doesn't validate the Lead Agent's output against expected gates | `SKILL.md` Step 4 | Add output validation that checks for review/security evidence |

## Changes

### File 1: `/Users/walid/.claude/skills/swarm/SKILL.md`

**Change A — Remove shortcut permissions from Step 3 prompt template (line ~208-218)**

The CRITICAL INSTRUCTIONS block in Step 3 currently says generic things. The launcher (me, in the previous run) added ad-hoc shortcuts like "you can skip TDD/testing agents". Harden the template to explicitly forbid skipping gates.

Replace the CRITICAL INSTRUCTIONS template with:

```
## CRITICAL INSTRUCTIONS

- You MUST complete ALL spec items before returning. Do NOT stop early.
- If you encounter a blocker, escalate via AskUserQuestion — do NOT silently stop.
- Run the full orchestration loop for EVERY iteration: Phase A (Planification + Test) → Phase B (Code + Review + Security) → Phase C (Escalation) → Phase D (Lint + Build + Commit).
- NEVER skip Code Review or Security Review — even for config-only packages, static sites, or "simple" changes. These gates are mandatory without exception.
- NEVER skip the Test Agent — every iteration MUST produce tests. For config packages, tests validate that configs are parseable and exports resolve correctly.
- Commit each validated iteration.
- Write the delivery report to docs/swarm/<session-name>/delivery-report.md before returning.
- Before returning your completion report, run the SELF-AUDIT CHECKLIST (see your agent definition). Your report will be validated against it.
```

**Change B — Add output validation in Step 4 (after line ~221)**

After receiving the Lead Agent's completion report, validate that mandatory gates were actually executed:

```markdown
### Output Validation (mandatory — before proceeding to Step 5)

Before accepting the Lead Agent's result, validate the delivery report:

1. Read `docs/swarm/<session-name>/delivery-report.md`
2. Check the "Per-Iteration Breakdown" table:
   - Every iteration MUST have a "Review Issues" column with actual counts (not "N/A" or missing)
   - Every iteration MUST show test counts in the "Tests" column
3. Check `docs/swarm/<session-name>/iterations.md`:
   - Every iteration entry MUST have `**Review**:` and `**Lint**:` and `**Build**:` lines
4. If ANY iteration is missing review/security/test evidence:
   - Do NOT proceed to Step 5
   - Re-spawn the Lead Agent with:
     - The current state of the codebase
     - A directive: "VALIDATION FAILURE: Iterations [list] are missing mandatory review/security/test gates. You MUST run the missing phases before returning. Do NOT re-implement code — only run the missing Phase B agents (code-review-agent, security-agent) and Phase A (test-agent) on the existing files."
   - Attach the list of changed files per iteration from the delivery report
```

### File 2: `/Users/walid/.claude/agents/lead-agent.md`

**Change C — Add SELF-AUDIT CHECKLIST section (before COMPLETION PROTOCOL, ~line 485)**

Add a new section that the Lead Agent MUST execute before writing the completion report:

```markdown
## SELF-AUDIT CHECKLIST (MANDATORY — before Completion)

Before writing the delivery report or returning the completion report, you MUST verify every item below. If ANY check fails, you are NOT done — go back and fix it.

### Per-Iteration Checks

For EACH completed iteration, verify:

| # | Check | How to Verify | If Missing |
|---|-------|---------------|------------|
| 1 | Test Agent was spawned | `TestAgentOutput` exists in your state for this iteration | Re-run Phase A for this iteration |
| 2 | Test files exist on disk | Glob for test files created in this iteration | Re-run Phase A |
| 3 | Code Review Agent was spawned | `ReviewAgentOutput` exists in your state for this iteration | Spawn code-review-agent now with the iteration's changed files |
| 4 | Security Agent was spawned | `SecurityAgentOutput` exists in your state for this iteration | Spawn security-agent now with the iteration's changed files |
| 5 | Lint passed | Lint was run and passed (or only pre-existing errors) | Run lint now, fix iteration file errors |
| 6 | Build passed | Build command was run and succeeded | Run build now, loop back to Phase A if it fails |
| 7 | Iteration was committed | `git log` shows a commit for this iteration | Stage and commit now |

### Global Checks

| # | Check | How to Verify | If Missing |
|---|-------|---------------|------------|
| 8 | All spec items accounted for | Every spec item is `completed`, `blocked`, or `skipped-by-user` | Identify missing items, run additional iterations |
| 9 | No orphan iterations | Every iteration in `iterations.md` has all 7 per-iteration checks passing | Fix the failing checks |
| 10 | Delivery report written | `docs/swarm/<session-name>/delivery-report.md` exists with Per-Iteration Breakdown table | Write it now |

### How to Execute

1. Walk through checks 1-7 for each iteration, logging pass/fail
2. If any check fails: fix it BEFORE proceeding (the table tells you how)
3. Walk through checks 8-10
4. Only after ALL checks pass: write the delivery report and return the completion report

**This checklist is NOT optional.** Skipping it is equivalent to skipping Code Review — a critical failure.
```

**Change D — Strengthen the anti-patterns section (~line 531)**

Add explicit anti-pattern for the "it's just configs" shortcut:

After line 537 (NEVER skip Security Review), add:

```markdown
7b. **NEVER rationalize skipping gates based on project type** — "It's just a config package", "There's no runtime code", "It's a static site" are NOT valid reasons to skip Test, Review, or Security phases. The gates exist for every iteration regardless of what the code does. Config packages need tests that validate export resolution. Static sites need review for DRY violations. Every project type benefits from quality gates.
```

**Change E — Add iteration validation to Phase D (~line 285)**

Before the commit step (D2), add a mini-audit:

After D1 (Build Check) and before D2 (Commit), add:

```markdown
#### D1.5. Phase Gate Verification

Before committing, verify that all mandatory phases actually ran for this iteration:

1. Confirm `TestAgentOutput` exists for this iteration — if not, Phase D is INVALID. Go back to Phase A.
2. Confirm `ReviewAgentOutput` exists for this iteration — if not, spawn code-review-agent NOW with this iteration's changed files. Wait for output.
3. Confirm `SecurityAgentOutput` exists for this iteration — if not, spawn security-agent NOW with this iteration's changed files. Wait for output.

This is a redundant safety net — Phase A and Phase B should already enforce these. But if an agent was skipped due to a bug or context pressure, this catches it before the commit makes it permanent.
```

## Verification

After making these changes:
1. Read the modified files to confirm the changes are coherent
2. Grep for any remaining references to "skip" + "review" or "skip" + "test" that might contradict the new rules
3. Verify the SELF-AUDIT CHECKLIST is referenced in both the COMPLETION PROTOCOL and the swarm SKILL.md output validation
